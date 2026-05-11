export const ALLERGENS = [
  'Susu',
  'Telur',
  'Kacang',
  'Kedelai',
  'Gandum',
  'Seafood',
  'Kerang',
  'Wijen'
];

export const ALLERGEN_MAPPING: Record<string, string[]> = {
  'Susu': ['susu', 'milk', 'whey', 'kasein', 'casein', 'laktosa', 'lactose', 'mentega', 'butter', 'keju', 'cheese', 'yoghurt', 'yogurt', 'krim', 'cream'],
  'Telur': ['telur', 'egg', 'albumin', 'kuning telur', 'egg yolk', 'putih telur', 'egg white', 'mayones', 'mayonnaise', 'ovomucin', 'ovoglobulin'],
  'Kacang': ['kacang', 'peanut', 'nut', 'almond', 'mete', 'cashew', 'hazelnut', 'walnut', 'pistachio', 'macadamia', 'pecan'],
  'Kedelai': ['kedelai', 'soy', 'soya', 'lecithin', 'lesitin', 'tempe', 'tahu', 'tofu', 'edamame'],
  'Gandum': ['gandum', 'wheat', 'gluten', 'terigu', 'tepung', 'flour', 'barley', 'rye', 'oat'],
  'Seafood': ['ikan', 'fish', 'seafood', 'ikan asin', 'abon ikan'],
  'Kerang': ['kerang', 'shellfish', 'udang', 'shrimp', 'prawn', 'kepiting', 'crab', 'lobster', 'cumi', 'squid', 'gurita', 'octopus'],
  'Wijen': ['wijen', 'sesame', 'tahini']
};
