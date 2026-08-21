import { Request, Response } from 'express';
import { store } from '../db/store.ts';
import {
  Venue,
  SeatCategory,
  Seat,
  CreateVenueRequestDTO,
  CreateCategoryRequestDTO,
  DefineSeatGridRequestDTO,
} from '../types/index.ts';

export class VenuesController {
  /**
   * List all venues with summary count of categories and seats
   */
  public static async listVenues(req: Request, res: Response): Promise<void> {
    try {
      const venuesList = Array.from(store.venues.values()).map((v) => {
        const categories = Array.from(store.categories.values()).filter((c) => c.venueId === v.id);
        const seats = Array.from(store.seats.values()).filter((s) => s.venueId === v.id);
        return {
          ...v,
          categoriesCount: categories.length,
          seatsCount: seats.length,
          categories,
        };
      });

      res.status(200).json({ venues: venuesList });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Get single venue with full categories and seat grid
   */
  public static async getVenueById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const venue = store.venues.get(id);

      if (!venue) {
        res.status(404).json({ error: 'NotFound', message: `Venue with id ${id} not found.` });
        return;
      }

      const categories = Array.from(store.categories.values()).filter((c) => c.venueId === id);
      const seats = Array.from(store.seats.values()).filter((s) => s.venueId === id && s.isActive);

      res.status(200).json({
        venue: {
          ...venue,
          categories,
          seats,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Admin: Create new venue with optional initial seat categories
   */
  public static async createVenue(req: Request, res: Response): Promise<void> {
    try {
      const { name, address, city, categories }: CreateVenueRequestDTO = req.body;

      if (!name || !address || !city) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Fields name, address, and city are required.',
        });
        return;
      }

      const venueId = `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newVenue: Venue = {
        id: venueId,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        totalCapacity: 0,
        createdBy: req.user?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.venues.set(newVenue.id, newVenue);

      // Create initial categories if provided
      const createdCategories: SeatCategory[] = [];
      if (categories && Array.isArray(categories) && categories.length > 0) {
        for (const cat of categories) {
          const categoryId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const newCategory: SeatCategory = {
            id: categoryId,
            venueId: newVenue.id,
            name: cat.name.trim(),
            description: cat.description?.trim(),
            colorCode: cat.colorCode || '#3B82F6',
            createdAt: new Date().toISOString(),
          };
          store.categories.set(newCategory.id, newCategory);
          createdCategories.push(newCategory);
        }
      } else {
        // Create default standard category
        const defaultCat: SeatCategory = {
          id: `cat-std-${Date.now()}`,
          venueId: newVenue.id,
          name: 'Standard',
          description: 'Standard admission seating',
          colorCode: '#10B981',
          createdAt: new Date().toISOString(),
        };
        store.categories.set(defaultCat.id, defaultCat);
        createdCategories.push(defaultCat);
      }

      res.status(201).json({
        message: 'Venue created successfully',
        venue: {
          ...newVenue,
          categories: createdCategories,
          seatsCount: 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Admin: Add/Define seat category for a venue
   */
  public static async addCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id: venueId } = req.params;
      const { name, description, colorCode }: CreateCategoryRequestDTO = req.body;

      const venue = store.venues.get(venueId);
      if (!venue) {
        res.status(404).json({ error: 'NotFound', message: `Venue with id ${venueId} not found.` });
        return;
      }

      if (!name) {
        res.status(400).json({ error: 'ValidationError', message: 'Category name is required.' });
        return;
      }

      // Check unique category name per venue
      const existing = Array.from(store.categories.values()).find(
        (c) => c.venueId === venueId && c.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (existing) {
        res.status(409).json({
          error: 'Conflict',
          message: `Category with name '${name}' already exists in this venue.`,
        });
        return;
      }

      const categoryId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newCategory: SeatCategory = {
        id: categoryId,
        venueId,
        name: name.trim(),
        description: description?.trim(),
        colorCode: colorCode || '#3B82F6',
        createdAt: new Date().toISOString(),
      };

      store.categories.set(newCategory.id, newCategory);

      res.status(201).json({
        message: 'Seat category created successfully',
        category: newCategory,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Admin: Define seat layout (Rows/Columns/Custom seat grid)
   */
  public static async defineSeatGrid(req: Request, res: Response): Promise<void> {
    try {
      const { id: venueId } = req.params;
      const { rows }: DefineSeatGridRequestDTO = req.body;

      const venue = store.venues.get(venueId);
      if (!venue) {
        res.status(404).json({ error: 'NotFound', message: `Venue with id ${venueId} not found.` });
        return;
      }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Rows array is required to construct the seat grid.',
        });
        return;
      }

      // Remove existing seats for this venue to rebuild layout
      const existingSeatIds = Array.from(store.seats.values())
        .filter((s) => s.venueId === venueId)
        .map((s) => s.id);
      for (const seatId of existingSeatIds) {
        store.seats.delete(seatId);
      }

      const createdSeats: Seat[] = [];
      let gridRowIndex = 1;

      for (const rowConfig of rows) {
        const { rowLabel, categoryId, seatCount, startNumber = 1, accessibleSeatNumbers = [] } = rowConfig;

        if (!rowLabel || !categoryId || !seatCount || seatCount <= 0) {
          res.status(400).json({
            error: 'ValidationError',
            message: 'Each row configuration must have rowLabel, categoryId, and positive seatCount.',
          });
          return;
        }

        const category = store.categories.get(categoryId);
        if (!category || category.venueId !== venueId) {
          res.status(400).json({
            error: 'ValidationError',
            message: `Category id ${categoryId} does not exist in venue ${venueId}.`,
          });
          return;
        }

        for (let i = 0; i < seatCount; i++) {
          const seatNumber = startNumber + i;
          const gridCol = i + 1;
          const isAccessible = accessibleSeatNumbers.includes(seatNumber);

          const seat: Seat = {
            id: `s-${venueId}-${rowLabel}-${seatNumber}`,
            venueId,
            categoryId,
            rowLabel,
            seatNumber,
            gridRow: gridRowIndex,
            gridCol,
            isAccessible,
            isActive: true,
            createdAt: new Date().toISOString(),
          };

          store.seats.set(seat.id, seat);
          createdSeats.push(seat);
        }

        gridRowIndex++;
      }

      // Update venue total capacity
      venue.totalCapacity = createdSeats.length;
      venue.updatedAt = new Date().toISOString();
      store.venues.set(venue.id, venue);

      res.status(200).json({
        message: 'Seat grid layout generated and saved successfully',
        venueId,
        totalCapacity: venue.totalCapacity,
        seatsCount: createdSeats.length,
        seats: createdSeats,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
