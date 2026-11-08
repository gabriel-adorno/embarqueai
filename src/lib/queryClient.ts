import { onlineManager, QueryClient } from '@tanstack/react-query';
import { addNetworkStateListener } from 'expo-network';

// Pausa as consultas sem internet e recarrega tudo quando a conexão volta.
onlineManager.setEventListener((setOnline) => {
  const sub = addNetworkStateListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});
