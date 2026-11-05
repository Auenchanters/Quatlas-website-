// The aircraft. SPECS: real measurements in millimetres; null hides the value on the blueprint.
// PARTS: legend for the drawing and the 3D model (explode = offset in model units when exploded).
export const SPECS = { span: null, length: null, height: null, chord: null };

// The parts, with the four qualities from the SAE overview: weight, aerodynamics, propulsion, structure.
export const PARTS = {
  wing: { name: 'Wing', quality: 'Aerodynamic finesse', text: 'Generates the lift that carries the payload. Span, chord and area are fixed in Conceptual Design & Sizing.', explode: [0, 0, 4.4] },
  fuselage: { name: 'Fuselage', quality: 'Structural integrity', text: 'Takes every load between the wing, tail and landing gear. Modelled in 3D CAD before a single part is cut.', explode: [0, 0, 0] },
  payload: { name: 'Payload bay', quality: 'Weight optimization', text: 'The mission. In 2015, its first year, the team lifted 13.6 kg: the highest payload carried by an Indian team in the competition’s history.', explode: [0, 0, 2.8] },
  motor: { name: 'Motor & prop', quality: 'Propulsion efficiency', text: 'Turns battery power into thrust. Every gram it saves is a gram of payload the aircraft can carry.', explode: [3.2, 0, 0] },
  tail: { name: 'Tail', quality: 'Stability', text: 'The horizontal and vertical stabilisers keep the aircraft steady and pointed where the pilot wants it.', explode: [-3.4, 0, 0.6] },
  gear: { name: 'Landing gear', quality: 'Takeoff & landing', text: 'Has to survive the takeoff and landing requirements of every flight round, loaded.', explode: [0, 0, -2] },
};
