import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Reservation } from './Reservation.js';

@Entity()
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerNight!: number;

  @Column({ type: 'int' })
  maxGuests!: number;

  @Column({ type: 'varchar' })
  city!: string;

  @OneToMany(() => Reservation, (reservation) => reservation.listing)
  reservations!: Reservation[];
}
