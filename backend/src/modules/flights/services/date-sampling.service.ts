import { Injectable } from '@nestjs/common';
import { FlexibleSearchDto, DateType } from '../dto/flexible-search.dto';

export interface DateSample {
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  nightsAtDestination: number;
  label: string; // e.g., "Dec 13-15 (Fri-Sun)"
}

@Injectable()
export class DateSamplingService {
  /**
   * Generate specific date samples from flexible search criteria.
   * Returns an array of departure/return date pairs to search.
   */
  generateDateSamples(dto: FlexibleSearchDto): DateSample[] {
    switch (dto.dateType) {
      case DateType.SPECIFIC:
        return this.generateSpecificSample(dto);
      case DateType.MONTH:
        return this.generateMonthSamples(dto);
      case DateType.RANGE:
        return this.generateRangeSamples(dto);
      case DateType.WEEKENDS:
        return this.generateWeekendSamples(dto);
      default:
        return [];
    }
  }

  private generateSpecificSample(dto: FlexibleSearchDto): DateSample[] {
    if (!dto.departureDate) return [];

    const depDate = new Date(dto.departureDate);
    const retDate = dto.returnDate ? new Date(dto.returnDate) : null;

    const nights = retDate
      ? Math.ceil((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return [
      {
        departureDate: dto.departureDate,
        returnDate: dto.returnDate || dto.departureDate,
        nightsAtDestination: nights,
        label: this.formatDateLabel(depDate, retDate),
      },
    ];
  }

  private generateMonthSamples(dto: FlexibleSearchDto): DateSample[] {
    if (!dto.month) return [];

    const [year, month] = dto.month.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // Last day of month

    return this.sampleDatesInRange(
      firstDay,
      lastDay,
      dto.minNights,
      dto.maxNights,
      8, // Sample ~8 different departure dates across the month
    );
  }

  private generateRangeSamples(dto: FlexibleSearchDto): DateSample[] {
    if (!dto.dateRangeStart || !dto.dateRangeEnd) return [];

    const startDate = new Date(dto.dateRangeStart);
    const endDate = new Date(dto.dateRangeEnd);

    // Calculate range length to determine sample count
    const rangeDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const sampleCount = Math.min(10, Math.max(4, Math.ceil(rangeDays / 7)));

    return this.sampleDatesInRange(
      startDate,
      endDate,
      dto.minNights,
      dto.maxNights,
      sampleCount,
    );
  }

  private generateWeekendSamples(dto: FlexibleSearchDto): DateSample[] {
    if (!dto.dateRangeStart || !dto.dateRangeEnd) return [];

    const samples: DateSample[] = [];
    const startDate = new Date(dto.dateRangeStart);
    const endDate = new Date(dto.dateRangeEnd);

    // Find all Fridays in the range
    const current = new Date(startDate);
    // Move to next Friday
    while (current.getDay() !== 5) {
      current.setDate(current.getDate() + 1);
    }

    while (current <= endDate) {
      // For each Friday, generate samples with different return days
      const friday = new Date(current);

      // Weekend options: Fri-Sun (2 nights), Fri-Mon (3 nights), Thu-Sun (3 nights)
      const durations = this.getDurationsInRange(dto.minNights, dto.maxNights);

      for (const nights of durations) {
        const returnDate = new Date(friday);
        returnDate.setDate(returnDate.getDate() + nights);

        // Make sure return is within our search range (give some buffer)
        const maxReturn = new Date(endDate);
        maxReturn.setDate(maxReturn.getDate() + dto.maxNights);

        if (returnDate <= maxReturn) {
          samples.push({
            departureDate: this.formatDate(friday),
            returnDate: this.formatDate(returnDate),
            nightsAtDestination: nights,
            label: this.formatDateLabel(friday, returnDate),
          });
        }
      }

      // Move to next Friday
      current.setDate(current.getDate() + 7);
    }

    // Limit to reasonable number of samples
    return this.limitSamples(samples, 12);
  }

  private sampleDatesInRange(
    startDate: Date,
    endDate: Date,
    minNights: number,
    maxNights: number,
    targetSampleCount: number,
  ): DateSample[] {
    const samples: DateSample[] = [];
    const rangeDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Calculate step size to spread samples across the range
    const step = Math.max(1, Math.floor(rangeDays / targetSampleCount));

    // Get duration options within min/max range
    const durations = this.getDurationsInRange(minNights, maxNights);

    const currentDate = new Date(startDate);

    while (currentDate <= endDate && samples.length < targetSampleCount * durations.length) {
      for (const nights of durations) {
        const returnDate = new Date(currentDate);
        returnDate.setDate(returnDate.getDate() + nights);

        // Allow return date to be slightly after end date (within max nights)
        const maxReturn = new Date(endDate);
        maxReturn.setDate(maxReturn.getDate() + maxNights);

        if (returnDate <= maxReturn) {
          samples.push({
            departureDate: this.formatDate(currentDate),
            returnDate: this.formatDate(returnDate),
            nightsAtDestination: nights,
            label: this.formatDateLabel(currentDate, returnDate),
          });
        }
      }

      // Move to next sample date
      currentDate.setDate(currentDate.getDate() + step);
    }

    return this.limitSamples(samples, targetSampleCount * 2);
  }

  /**
   * Get a representative set of durations within the min/max range.
   * e.g., for 7-14 nights, might return [7, 10, 14]
   */
  private getDurationsInRange(minNights: number, maxNights: number): number[] {
    if (minNights === maxNights) {
      return [minNights];
    }

    const range = maxNights - minNights;

    if (range <= 2) {
      // Small range: include all
      const durations: number[] = [];
      for (let i = minNights; i <= maxNights; i++) {
        durations.push(i);
      }
      return durations;
    }

    if (range <= 5) {
      // Medium range: min, middle, max
      return [minNights, Math.floor((minNights + maxNights) / 2), maxNights];
    }

    // Large range: min, 1/3, 2/3, max
    const third = Math.floor(range / 3);
    return [
      minNights,
      minNights + third,
      minNights + third * 2,
      maxNights,
    ];
  }

  /**
   * Limit samples to a maximum count, keeping a good distribution.
   */
  private limitSamples(samples: DateSample[], maxCount: number): DateSample[] {
    if (samples.length <= maxCount) {
      return samples;
    }

    // Sort by departure date and pick evenly distributed samples
    const sorted = [...samples].sort(
      (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime(),
    );

    const step = samples.length / maxCount;
    const result: DateSample[] = [];

    for (let i = 0; i < maxCount; i++) {
      const index = Math.floor(i * step);
      result.push(sorted[index]);
    }

    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateLabel(departure: Date, returnDate: Date | null): string {
    const depMonth = departure.toLocaleDateString('en-US', { month: 'short' });
    const depDay = departure.getDate();
    const depDow = departure.toLocaleDateString('en-US', { weekday: 'short' });

    if (!returnDate) {
      return `${depMonth} ${depDay} (${depDow})`;
    }

    const retMonth = returnDate.toLocaleDateString('en-US', { month: 'short' });
    const retDay = returnDate.getDate();
    const retDow = returnDate.toLocaleDateString('en-US', { weekday: 'short' });

    if (depMonth === retMonth) {
      return `${depMonth} ${depDay}-${retDay} (${depDow}-${retDow})`;
    }

    return `${depMonth} ${depDay} - ${retMonth} ${retDay} (${depDow}-${retDow})`;
  }
}
