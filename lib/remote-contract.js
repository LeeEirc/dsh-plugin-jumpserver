import { z } from 'zod';

// Explicit descriptors and strict JSON codecs shared by host and desktop/Web.
// Business fields are checked by JumpServerManager.dispatch.
const jsonCodec = { mode: 'strict', typeSymbol: 'dsh-plugin-jumpserver#Json', create: () => z.json() };
export const remoteContract = {
  package: 'dsh-plugin-jumpserver',
  descriptors: [{
    id: 'dsh-plugin-jumpserver#jumpserver/request', service: 'jumpserver', namespace: 'jumpserver', method: 'request',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'input', wire: 'input', source: 'json', codec: jsonCodec }],
    result: jsonCodec,
  }],
};
