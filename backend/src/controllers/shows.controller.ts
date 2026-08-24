import { Request, Response } from 'express';
import { store } from '../db/store.ts';
import {
  Show,
  ShowPricing,
  CreateShowRequestDTO,
  UpdateShowRequestDTO,
  ShowRevenueSummaryDTO,
} from '../types/index.ts';

export class ShowsController {
  /**
   * Public: List all published shows with venue info and category pricing
   */
  public static async listShows(req: Request, res: Response): Promise<void> {
    try {
      const { category, search } = req.query;
      let showsList = Array.from(store.shows.values()).filter((s) => s.isPublished);

      if (category && typeof category === 'string') {
        showsList = showsList.filter((s) => s.category.toLowerCase() === category.toLowerCase());
      }

      if (search && typeof search === 'string') {
        const query = search.toLowerCase();
        showsList = showsList.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query)
        );
      }

      const enrichedShows = showsList.map((show) => {
        const venue = store.venues.get(show.venueId);
        const pricing = Array.from(store.showPricing.values())
          .filter((p) => p.showId === show.id)
          .map((p) => {
            const cat = store.categories.get(p.categoryId);
            return {
              ...p,
              categoryName: cat?.name || 'Unknown',
              colorCode: cat?.colorCode || '#3B82F6',
            };
          });

        const showSeats = Array.from(store.showSeats.values()).filter((ss) => ss.showId === show.id);
        const totalSeats = showSeats.length;
        const availableSeats = showSeats.filter((ss) => ss.status === 'AVAILABLE').length;

        return {
          ...show,
          venue,
          pricing,
          totalSeats,
          availableSeats,
          isSoldOut: availableSeats === 0,
        };
      });

      res.status(200).json({ shows: enrichedShows });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Public: Get show by ID with seat categories, pricing, and venue details
   */
  public static async getShowById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const show = store.shows.get(id);

      if (!show) {
        res.status(404).json({ error: 'NotFound', message: `Show with id ${id} not found.` });
        return;
      }

      const venue = store.venues.get(show.venueId);
      const categories = Array.from(store.categories.values()).filter((c) => c.venueId === show.venueId);
      const pricing = Array.from(store.showPricing.values())
        .filter((p) => p.showId === id)
        .map((p) => {
          const cat = store.categories.get(p.categoryId);
          return {
            ...p,
            categoryName: cat?.name || 'Unknown',
            colorCode: cat?.colorCode || '#3B82F6',
            description: cat?.description,
          };
        });

      const showSeats = Array.from(store.showSeats.values()).filter((ss) => ss.showId === id);
      const totalSeats = showSeats.length;
      const availableSeats = showSeats.filter((ss) => ss.status === 'AVAILABLE').length;
      const heldSeats = showSeats.filter((ss) => ss.status === 'HELD').length;
      const bookedSeats = showSeats.filter((ss) => ss.status === 'BOOKED').length;

      res.status(200).json({
        show: {
          ...show,
          venue,
          categories,
          pricing,
          seatStats: {
            totalSeats,
            availableSeats,
            heldSeats,
            bookedSeats,
            isSoldOut: availableSeats === 0,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Organiser: List shows created by the logged-in organiser
   */
  public static async listOrganiserShows(req: Request, res: Response): Promise<void> {
    try {
      const organiserId = req.user!.id;
      const isSystemAdmin = req.user!.role === 'ADMIN';
      const isOrganiser = req.user!.role === 'ORGANISER';

      const showsList = Array.from(store.shows.values())
        .filter((s) => isSystemAdmin || isOrganiser || s.organiserId === organiserId)
        .map((show) => {
          const venue = store.venues.get(show.venueId);
          const showSeats = Array.from(store.showSeats.values()).filter((ss) => ss.showId === show.id);
          const bookings = Array.from(store.bookings.values()).filter(
            (b) => b.showId === show.id && b.status === 'CONFIRMED'
          );
          const totalRevenueCents = bookings.reduce((sum, b) => sum + b.totalAmountCents, 0);

          return {
            ...show,
            venueName: venue?.name || 'Unknown Venue',
            totalSeats: showSeats.length,
            availableSeats: showSeats.filter((ss) => ss.status === 'AVAILABLE').length,
            bookedSeats: showSeats.filter((ss) => ss.status === 'BOOKED').length,
            totalBookings: bookings.length,
            totalRevenueCents,
          };
        });

      res.status(200).json({ shows: showsList });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Organiser: Create new show
   * CRITICAL REQUIREMENT: Automatically instantiates ShowSeats rows for the show
   * based on the venue's seat layout, with every seat initialized to 'AVAILABLE'.
   */
  public static async createShow(req: Request, res: Response): Promise<void> {
    try {
      const organiserId = req.user!.id;
      const {
        venueId,
        title,
        description,
        bannerImageUrl,
        category,
        startTime,
        endTime,
        holdDurationMinutes = 10,
        offerDurationMinutes = 15,
        isPublished = true,
        pricing,
      }: CreateShowRequestDTO = req.body;

      // Validation
      if (!venueId || !title || !category || !startTime || !endTime) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Fields venueId, title, category, startTime, and endTime are required.',
        });
        return;
      }

      const venue = store.venues.get(venueId);
      if (!venue) {
        res.status(404).json({ error: 'NotFound', message: `Venue with id ${venueId} not found.` });
        return;
      }

      const venueSeats = Array.from(store.seats.values()).filter(
        (s) => s.venueId === venueId && s.isActive
      );
      if (venueSeats.length === 0) {
        res.status(400).json({
          error: 'VenueHasNoSeats',
          message: 'The selected venue does not have any configured seats. Please generate the venue seat grid first.',
        });
        return;
      }

      if (!pricing || !Array.isArray(pricing) || pricing.length === 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Pricing array for seat categories is required.',
        });
        return;
      }

      const showId = `show-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newShow: Show = {
        id: showId,
        venueId,
        organiserId,
        title: title.trim(),
        description: description?.trim(),
        bannerImageUrl:
          bannerImageUrl?.trim() ||
          'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
        category: category.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        holdDurationMinutes: Number(holdDurationMinutes) || 10,
        offerDurationMinutes: Number(offerDurationMinutes) || 15,
        isPublished: Boolean(isPublished),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.shows.set(newShow.id, newShow);

      // Save category pricing
      const createdPricing: ShowPricing[] = [];
      for (const priceItem of pricing) {
        const pricingId = `p-${newShow.id}-${priceItem.categoryId}`;
        const newPricing: ShowPricing = {
          id: pricingId,
          showId: newShow.id,
          categoryId: priceItem.categoryId,
          priceCents: Number(priceItem.priceCents),
          currency: priceItem.currency || 'USD',
        };
        store.showPricing.set(newPricing.id, newPricing);
        createdPricing.push(newPricing);
      }

      // AUTOMATIC GENERATION OF SHOW SEATS
      const createdShowSeats = store.generateShowSeatsForShow(newShow.id, venue.id);

      res.status(201).json({
        message: 'Show created and seat layout successfully initialized',
        show: {
          ...newShow,
          venue: {
            id: venue.id,
            name: venue.name,
            city: venue.city,
          },
          pricing: createdPricing,
          totalSeatsGenerated: createdShowSeats.length,
          initialSeatStatus: 'AVAILABLE',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Organiser: Update show details or category pricing
   */
  public static async updateShow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const organiserId = req.user!.id;
      const isSystemAdmin = req.user!.role === 'ADMIN';

      const show = store.shows.get(id);
      if (!show) {
        res.status(404).json({ error: 'NotFound', message: `Show with id ${id} not found.` });
        return;
      }

      if (!isSystemAdmin && show.organiserId !== organiserId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to update this event listing.',
        });
        return;
      }

      const updates: UpdateShowRequestDTO = req.body;

      if (updates.title !== undefined) show.title = updates.title.trim();
      if (updates.description !== undefined) show.description = updates.description.trim();
      if (updates.bannerImageUrl !== undefined) show.bannerImageUrl = updates.bannerImageUrl.trim();
      if (updates.category !== undefined) show.category = updates.category.trim();
      if (updates.startTime !== undefined) show.startTime = new Date(updates.startTime).toISOString();
      if (updates.endTime !== undefined) show.endTime = new Date(updates.endTime).toISOString();
      if (updates.holdDurationMinutes !== undefined)
        show.holdDurationMinutes = Number(updates.holdDurationMinutes);
      if (updates.offerDurationMinutes !== undefined)
        show.offerDurationMinutes = Number(updates.offerDurationMinutes);
      if (updates.isPublished !== undefined) show.isPublished = Boolean(updates.isPublished);

      show.updatedAt = new Date().toISOString();
      store.shows.set(show.id, show);

      // Update pricing if provided
      if (updates.pricing && Array.isArray(updates.pricing)) {
        for (const priceItem of updates.pricing) {
          const existingPricing = Array.from(store.showPricing.values()).find(
            (p) => p.showId === id && p.categoryId === priceItem.categoryId
          );
          if (existingPricing) {
            existingPricing.priceCents = Number(priceItem.priceCents);
            if (priceItem.currency) existingPricing.currency = priceItem.currency;
            store.showPricing.set(existingPricing.id, existingPricing);
          } else {
            const pricingId = `p-${id}-${priceItem.categoryId}`;
            const newPricing: ShowPricing = {
              id: pricingId,
              showId: id,
              categoryId: priceItem.categoryId,
              priceCents: Number(priceItem.priceCents),
              currency: priceItem.currency || 'USD',
            };
            store.showPricing.set(newPricing.id, newPricing);
          }
        }
      }

      res.status(200).json({
        message: 'Show updated successfully',
        show,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Organiser: View detailed booking summary and total revenue breakdown per event
   */
  public static async getShowSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const organiserId = req.user!.id;
      const isSystemAdmin = req.user!.role === 'ADMIN';
      const isOrganiser = req.user!.role === 'ORGANISER';

      const show = store.shows.get(id);
      if (!show) {
        res.status(404).json({ error: 'NotFound', message: `Show with id ${id} not found.` });
        return;
      }

      if (!isSystemAdmin && !isOrganiser && show.organiserId !== organiserId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to view revenue data for this event.',
        });
        return;
      }

      const venue = store.venues.get(show.venueId);
      const categories = Array.from(store.categories.values()).filter((c) => c.venueId === show.venueId);
      const showSeats = Array.from(store.showSeats.values()).filter((ss) => ss.showId === id);
      const bookings = Array.from(store.bookings.values()).filter((b) => b.showId === id);

      const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');
      const totalRevenueCents = confirmedBookings.reduce((sum, b) => sum + b.totalAmountCents, 0);

      const totalSeats = showSeats.length;
      const bookedSeats = showSeats.filter((ss) => ss.status === 'BOOKED').length;
      const heldSeats = showSeats.filter((ss) => ss.status === 'HELD').length;
      const availableSeats = showSeats.filter((ss) => ss.status === 'AVAILABLE').length;

      const categoryBreakdown = categories.map((cat) => {
        const catPricing = Array.from(store.showPricing.values()).find(
          (p) => p.showId === id && p.categoryId === cat.id
        );
        const catSeats = showSeats.filter((ss) => ss.categoryId === cat.id);
        const catBooked = catSeats.filter((ss) => ss.status === 'BOOKED').length;
        const catHeld = catSeats.filter((ss) => ss.status === 'HELD').length;
        const catAvail = catSeats.filter((ss) => ss.status === 'AVAILABLE').length;
        const priceCents = catPricing?.priceCents || 0;
        const catRevenue = catBooked * priceCents;

        const catWaitlistCount = Array.from(store.waitlist.values()).filter(
          (w) => w.showId === id && w.categoryId === cat.id && w.status === 'WAITING'
        ).length;

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          colorCode: cat.colorCode,
          priceCents,
          totalSeats: catSeats.length,
          bookedSeats: catBooked,
          heldSeats: catHeld,
          availableSeats: catAvail,
          revenueCents: catRevenue,
          waitlistCount: catWaitlistCount,
        };
      });

      const summary: ShowRevenueSummaryDTO = {
        showId: show.id,
        title: show.title,
        startTime: show.startTime,
        venueName: venue?.name || 'Unknown Venue',
        totalSeats,
        availableSeats,
        heldSeats,
        bookedSeats,
        totalBookings: confirmedBookings.length,
        totalRevenueCents,
        currency: 'USD',
        occupancyPercentage: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
        categoryBreakdown,
      };

      res.status(200).json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
