import { apiSlice } from '../../store/api/apiSlice';

/**
 * The server half of push subscriptions. The VAPID public key is fetched
 * with plain fetch inside usePushNotifications — it is public, unauthed and
 * needed mid-gesture, so it has no business in the cache.
 */
export const pushApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    subscribePush: builder.mutation<
      void,
      { endpoint: string; keys: { p256dh: string; auth: string } }
    >({
      query: (body) => ({
        url: '/push/subscribe',
        method: 'POST',
        body,
      }),
    }),

    unsubscribePush: builder.mutation<void, { endpoint: string }>({
      query: (body) => ({
        url: '/push/subscribe',
        method: 'DELETE',
        body,
      }),
    }),

    testPush: builder.mutation<void, void>({
      query: () => ({
        url: '/push/test',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useTestPushMutation,
} = pushApi;
