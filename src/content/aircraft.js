// The aircraft. SPECS: real measurements in millimetres; null hides the value on the blueprint.
// PARTS: the labels on the 3D model's parts (explode = offset in model units when the model is clicked apart).
export const SPECS = { span: null, length: null, height: null, chord: null };

export const PARTS = {
  wing: { name: 'Wing', explode: [0, 0, 4.4] },
  fuselage: { name: 'Fuselage', explode: [0, 0, 0] },
  payload: { name: 'Payload bay', explode: [0, 0, 2.8] },
  motor: { name: 'Motor & prop', explode: [3.2, 0, 0] },
  tail: { name: 'Tail', explode: [-3.4, 0, 0.6] },
  gear: { name: 'Landing gear', explode: [0, 0, -2] },
};
