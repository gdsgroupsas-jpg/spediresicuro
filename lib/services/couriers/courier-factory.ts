import { BaseCourierClient } from './base-courier.interface';
import { SpedisciOnlineClient } from './spediscionline.client';

export class CourierFactory {
  static getClient(
    provider: string, // 'spediscionline', 'poste_native', 'gls_native'
    carrier: string, // 'GLS', 'POSTE', 'BRT', 'UPS'
    config: {
      apiKey: string;
      baseUrl: string;
      contractId?: string;
    }
  ): BaseCourierClient {
    switch (provider.toLowerCase()) {
      case 'spediscionline':
      case 'spedisci.online':
      case 'spedisci_online':
        // SpedisciOnline gestisce TUTTI i corrieri (GLS, Poste, BRT, UPS, DHL, etc)
        return new SpedisciOnlineClient({
          ...config,
          carrier, // Passa il corriere specifico
        });

      // FUTURO: Altri provider nativi
      // case 'poste_native':
      // case 'poste-italiane-native':
      //   return new PosteItalianeNativeClient(config)

      // case 'gls_native':
      //   return new GLSNativeClient(config)

      // case 'brt_native':
      //   return new BRTNativeClient(config)

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
