import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Reservation } from './Reservation.js';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @OneToMany(() => Reservation, (reservation) => reservation.user)
  reservations!: Reservation[];
}
