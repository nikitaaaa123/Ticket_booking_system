import bcrypt from 'bcryptjs';
import {
  User,
  Venue,
  SeatCategory,
  Seat,
  Show,
  ShowPricing,
  ShowSeat,
  Booking,
  BookingItem,
  WaitlistEntry,
  WaitlistOffer,
  UserRole,
} from '../types/index.ts';

// In-Memory Canonical Store with Full Relational Constraints and Locking Primitives
class MemoryStore {
  public users: Map<string, User> = new Map();
  public venues: Map<string, Venue> = new Map();
  public categories: Map<string, SeatCategory> = new Map();
  public seats: Map<string, Seat> = new Map();
  public shows: Map<string, Show> = new Map();
  public showPricing: Map<string, ShowPricing> = new Map();
  public showSeats: Map<string, ShowSeat> = new Map();
  public bookings: Map<string, Booking> = new Map();
  public bookingSeats: Map<string, BookingItem> = new Map();
  public waitlist: Map<string, WaitlistEntry> = new Map();
  public waitlistOffers: Map<string, WaitlistOffer> = new Map();

  private priorityCounter: number = 100;
  public initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.seedInitialData();
  }

  public async seedInitialData(force = false): Promise<void> {
    if (!force && process.env.SEED_DATABASE === 'false') return;
    if (!force && this.users.size > 0 && this.shows.size > 0) return;

    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Password123!', salt);

    // 1. Seed Users
    const adminUser: User = {
      id: 'u-admin-1',
      email: 'admin@ticketbooking.com',
      passwordHash,
      fullName: 'System Administrator',
      phoneNumber: '+15550000001',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const organiserUser: User = {
      id: 'u-org-1',
      email: 'organiser@ticketbooking.com',
      passwordHash,
      fullName: 'Starlight Concerts & Movies',
      phoneNumber: '+15550000002',
      role: 'ORGANISER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const customerUser: User = {
      id: 'u-cust-1',
      email: 'customer@ticketbooking.com',
      passwordHash,
      fullName: 'Jane Doe',
      phoneNumber: '+15550000003',
      role: 'CUSTOMER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(organiserUser.id, organiserUser);
    this.users.set(customerUser.id, customerUser);

    // 2. Seed Venue 1: Dolby Atmos Cinema Grand
    const venue1: Venue = {
      id: 'v-dolby-1',
      name: 'Dolby Cinema Grand Stage',
      address: '742 Evergreen Terrace',
      city: 'San Francisco, CA',
      totalCapacity: 40,
      createdBy: adminUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.venues.set(venue1.id, venue1);

    // Categories for Venue 1
    const catVip: SeatCategory = {
      id: 'cat-vip-1',
      venueId: venue1.id,
      name: 'VIP Recliner',
      description: 'Ultra-plush motorized recliners with personal table and tray service',
      colorCode: '#8B5CF6', // Purple
      createdAt: new Date().toISOString(),
    };
    const catPrem: SeatCategory = {
      id: 'cat-prem-1',
      venueId: venue1.id,
      name: 'Premium',
      description: 'Center view extra legroom seating with premium acoustic balance',
      colorCode: '#3B82F6', // Blue
      createdAt: new Date().toISOString(),
    };
    const catStd: SeatCategory = {
      id: 'cat-std-1',
      venueId: venue1.id,
      name: 'Standard',
      description: 'Comfortable auditorium seating with clear sightlines',
      colorCode: '#10B981', // Green
      createdAt: new Date().toISOString(),
    };

    this.categories.set(catVip.id, catVip);
    this.categories.set(catPrem.id, catPrem);
    this.categories.set(catStd.id, catStd);

    // Seats for Venue 1 (Rows A to D, 10 seats per row = 40 seats)
    // Row A: VIP (10 seats)
    for (let c = 1; c <= 10; c++) {
      const seat: Seat = {
        id: `s-v1-A-${c}`,
        venueId: venue1.id,
        categoryId: catVip.id,
        rowLabel: 'A',
        seatNumber: c,
        gridRow: 1,
        gridCol: c,
        isAccessible: c === 1 || c === 10,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }
    // Row B: Premium (10 seats)
    for (let c = 1; c <= 10; c++) {
      const seat: Seat = {
        id: `s-v1-B-${c}`,
        venueId: venue1.id,
        categoryId: catPrem.id,
        rowLabel: 'B',
        seatNumber: c,
        gridRow: 2,
        gridCol: c,
        isAccessible: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }
    // Row C: Standard (10 seats)
    for (let c = 1; c <= 10; c++) {
      const seat: Seat = {
        id: `s-v1-C-${c}`,
        venueId: venue1.id,
        categoryId: catStd.id,
        rowLabel: 'C',
        seatNumber: c,
        gridRow: 3,
        gridCol: c,
        isAccessible: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }
    // Row D: Standard (10 seats)
    for (let c = 1; c <= 10; c++) {
      const seat: Seat = {
        id: `s-v1-D-${c}`,
        venueId: venue1.id,
        categoryId: catStd.id,
        rowLabel: 'D',
        seatNumber: c,
        gridRow: 4,
        gridCol: c,
        isAccessible: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }

    // 3. Seed Venue 2: Starlight Symphony Hall (Concert Hall)
    const venue2: Venue = {
      id: 'v-symphony-2',
      name: 'Starlight Symphony Amphitheatre',
      address: '100 Symphony Lane',
      city: 'Austin, TX',
      totalCapacity: 30,
      createdBy: adminUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.venues.set(venue2.id, venue2);

    const catFrontOrch: SeatCategory = {
      id: 'cat-orch-2',
      venueId: venue2.id,
      name: 'Front Orchestra',
      description: 'Closest proximity to stage with crystal acoustic reproduction',
      colorCode: '#EC4899', // Pink
      createdAt: new Date().toISOString(),
    };
    const catMezz: SeatCategory = {
      id: 'cat-mezz-2',
      venueId: venue2.id,
      name: 'Mezzanine Tier',
      description: 'Elevated panoramic perspective over the entire stage',
      colorCode: '#F59E0B', // Amber
      createdAt: new Date().toISOString(),
    };
    this.categories.set(catFrontOrch.id, catFrontOrch);
    this.categories.set(catMezz.id, catMezz);

    // Seats for Venue 2
    for (let c = 1; c <= 15; c++) {
      const seat: Seat = {
        id: `s-v2-O-${c}`,
        venueId: venue2.id,
        categoryId: catFrontOrch.id,
        rowLabel: 'Orchestra',
        seatNumber: c,
        gridRow: 1,
        gridCol: c,
        isAccessible: c === 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }
    for (let c = 1; c <= 15; c++) {
      const seat: Seat = {
        id: `s-v2-M-${c}`,
        venueId: venue2.id,
        categoryId: catMezz.id,
        rowLabel: 'Mezzanine',
        seatNumber: c,
        gridRow: 2,
        gridCol: c,
        isAccessible: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.seats.set(seat.id, seat);
    }

    // 4. Seed Show 1: Interstellar in 70mm Dolby
    const now = new Date();
    const show1StartTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now at 7:30 PM
    show1StartTime.setHours(19, 30, 0, 0);
    const show1EndTime = new Date(show1StartTime.getTime() + 3 * 60 * 60 * 1000);

    const show1: Show = {
      id: 'show-interstellar-1',
      venueId: venue1.id,
      organiserId: organiserUser.id,
      title: 'Interstellar: 10th Anniversary in 70mm Dolby Atmos',
      description: 'Experience Christopher Nolan’s breathtaking space odyssey with Hans Zimmer’s immersive score remastered for multi-channel spatial sound.',
      bannerImageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
      category: 'Movie',
      startTime: show1StartTime.toISOString(),
      endTime: show1EndTime.toISOString(),
      holdDurationMinutes: 10,
      offerDurationMinutes: 15,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.shows.set(show1.id, show1);

    // Show 1 Pricing
    const p1Vip: ShowPricing = { id: 'p-1-vip', showId: show1.id, categoryId: catVip.id, priceCents: 2800, currency: 'USD' }; // $28.00
    const p1Prem: ShowPricing = { id: 'p-1-prem', showId: show1.id, categoryId: catPrem.id, priceCents: 2100, currency: 'USD' }; // $21.00
    const p1Std: ShowPricing = { id: 'p-1-std', showId: show1.id, categoryId: catStd.id, priceCents: 1500, currency: 'USD' }; // $15.00
    this.showPricing.set(p1Vip.id, p1Vip);
    this.showPricing.set(p1Prem.id, p1Prem);
    this.showPricing.set(p1Std.id, p1Std);

    // Auto-generate ShowSeats for Show 1
    this.generateShowSeatsForShow(show1.id, venue1.id);

    // Seed Show 2: Hans Zimmer Live Symphony
    const show2StartTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    show2StartTime.setHours(20, 0, 0, 0);
    const show2EndTime = new Date(show2StartTime.getTime() + 2.5 * 60 * 60 * 1000);

    const show2: Show = {
      id: 'show-zimmer-2',
      venueId: venue2.id,
      organiserId: organiserUser.id,
      title: 'Hans Zimmer Live: World Tour Symphonic Orchestra',
      description: 'A 90-piece orchestra performing live iconic scores from Gladiator, Inception, Dune, and The Dark Knight.',
      bannerImageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
      category: 'Concert',
      startTime: show2StartTime.toISOString(),
      endTime: show2EndTime.toISOString(),
      holdDurationMinutes: 10,
      offerDurationMinutes: 15,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.shows.set(show2.id, show2);

    const p2Orch: ShowPricing = { id: 'p-2-orch', showId: show2.id, categoryId: catFrontOrch.id, priceCents: 9500, currency: 'USD' }; // $95.00
    const p2Mezz: ShowPricing = { id: 'p-2-mezz', showId: show2.id, categoryId: catMezz.id, priceCents: 6500, currency: 'USD' }; // $65.00
    this.showPricing.set(p2Orch.id, p2Orch);
    this.showPricing.set(p2Mezz.id, p2Mezz);

    this.generateShowSeatsForShow(show2.id, venue2.id);
    } catch (err: any) {
      console.error('[Store] Error during seedInitialData:', err);
    }
  }

  /**
   * Automatically instantiates ShowSeats rows for a show based on the venue's seats
   */
  public generateShowSeatsForShow(showId: string, venueId: string): ShowSeat[] {
    const createdShowSeats: ShowSeat[] = [];
    const venueSeats = Array.from(this.seats.values()).filter(
      (s) => s.venueId === venueId && s.isActive
    );

    for (const seat of venueSeats) {
      const showSeatId = `ss-${showId}-${seat.id}`;
      const showSeat: ShowSeat = {
        id: showSeatId,
        showId,
        seatId: seat.id,
        categoryId: seat.categoryId,
        status: 'AVAILABLE',
        heldByUserId: null,
        holdExpiresAt: null,
        holdSessionToken: null,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      this.showSeats.set(showSeat.id, showSeat);
      createdShowSeats.push(showSeat);
    }

    return createdShowSeats;
  }

  public getNextPriorityOrder(): number {
    this.priorityCounter += 1;
    return this.priorityCounter;
  }
}

export const store = new MemoryStore();
