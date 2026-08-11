import RouteBuilder from './RouteBuilder';
import { useAddFlightMutation } from '../../features/flights/flightsApi';
import { useToast } from '../Toast/ToastProvider';
import { useMapFocus } from '../../features/map/MapFocusContext';

function FlightForm() {
  const [addFlight, { isLoading }] = useAddFlightMutation();
  const { showToast } = useToast();
  const { focusJourney } = useMapFocus();

  const handleSubmit = async (data: {
    airportIds: number[];
    journeyDate?: string;
    isRoundTrip: boolean;
    notes?: string;
  }) => {
    try {
      const journey = await addFlight(data).unwrap();
      // Hand the map the new journey: the shell closes this panel and the
      // route flies itself. Submitting into a panel and seeing nothing
      // happen — with the map off screen on mobile — was a flat moment.
      focusJourney(journey.id);
    } catch {
      // This used to only reach console.error, so a failed submit looked
      // identical to a successful one.
      showToast('Could not add that flight', { tone: 'error' });
    }
  };

  return (
    <div>
      <h2 className="text-sm font-medium text-ink mb-3">Add a flight</h2>
      <RouteBuilder onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}

export default FlightForm;
