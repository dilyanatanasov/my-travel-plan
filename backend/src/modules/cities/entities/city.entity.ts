import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * A city, the endpoint of land travel (2026-08-17). "Varna to Plovdiv by
 * train" needs a name and coordinates - not a station registry. Seeded
 * from GeoNames cities1000 (every place with population over 1,000), the
 * same vendored-open-data pattern as airports.
 */
@Entity('cities')
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  /** GeoNames stable id - makes reseeding idempotent. */
  @Column({ name: 'geonames_id', unique: true })
  geonamesId: number;

  @Column({ length: 200 })
  name: string;

  /** Diacritic-free form; search matches this so "plovdiv" finds Пловдив. */
  @Column({ name: 'ascii_name', length: 200 })
  asciiName: string;

  @Column({ name: 'country_iso', length: 2 })
  countryIso: string;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  longitude: number;

  /** Orders search results - the Varna people mean is the big one. */
  @Column({ default: 0 })
  population: number;
}
