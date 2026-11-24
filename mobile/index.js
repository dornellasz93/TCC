import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent chama AppRegistry.registerComponent('main', () => App);
// Também garante que, ao carregar o app no Expo Go ou em um build nativo,
// o ambiente seja configurado adequadamente
registerRootComponent(App);
