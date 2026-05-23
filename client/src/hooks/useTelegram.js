import WebApp from '@twa-dev/sdk';

export function useTelegram() {
  const user = WebApp.initDataUnsafe?.user;
  return { WebApp, user };
}