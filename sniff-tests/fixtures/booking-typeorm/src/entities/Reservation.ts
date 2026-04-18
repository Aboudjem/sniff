import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from './User.js';
import { Listing } from './Listing.js';

@Entity()
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.reservations)
  user!: User;

  @ManyToOne(() => Listing, (listing) => listing.reservations)
  listing!: Listing;

  @Column({ type: 'timestamp' })
  checkIn!: Date;

  @Column({ type: 'timestamp' })
  checkOut!: Date;

  @Column({ type: 'varchar' })
  status!: string;
}
