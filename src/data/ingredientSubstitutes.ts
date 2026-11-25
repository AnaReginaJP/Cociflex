// Base de equivalencias culinarias de CociFlex.
// Cada entrada describe para qué sirve un ingrediente en el platillo y con qué se puede
// sustituir sin salirse de lo que la persona tiene en su despensa.
//
// Reglas de los datos:
// - Las proporciones son aproximadas y están pensadas para cocina casera.
// - La persona revisa cada equivalencia y anota su fuente cuando la tenga.
// - Si un ingrediente no se puede sustituir bien, se deja fuera o se marca en "avoidWhen".

export type IngredientFunction =
  | 'liquido'
  | 'grasa'
  | 'aglutinante'
  | 'leudante'
  | 'acido'
  | 'dulzor'
  | 'sabor'
  | 'espesante';

export interface SubstituteOption {
  /** Nombre canónico del sustituto, como aparece en la despensa. */
  name: string;
  /** Cuánto sustituto se necesita por 1 unidad del ingrediente original. */
  ratio: number;
  /** Unidad en la que se expresa la cantidad del sustituto. */
  unit: string;
  /** Cambio de sabor, textura o consistencia. */
  note: string;
  /** Alérgenos que aporta el sustituto. */
  allergens?: string[];
}

export interface SubstituteEntry {
  /** Nombre del ingrediente tal como aparece en las recetas. */
  ingredient: string;
  functions: IngredientFunction[];
  substitutes: SubstituteOption[];
  /** Cuándo no conviene sustituir y por qué. */
  avoidWhen?: string;
  /** Fuente revisada por la persona (etiqueta, libro, tabla de cocina). */
  source?: string;
}

export const INGREDIENT_SUBSTITUTES: SubstituteEntry[] = [
  {
    ingredient: 'Leche entera',
    functions: ['liquido', 'grasa'],
    substitutes: [
      {
        name: 'Yogur natural',
        ratio: 1,
        unit: 'taza',
        note: 'Queda un poco más espeso y aporta acidez suave; si la mezcla lo pide, dilúyelo con un poco de agua.',
        allergens: ['lácteo'],
      },
      {
        name: 'Crema ácida',
        ratio: 1,
        unit: 'taza',
        note: 'Aporta más grasa y un sabor ligeramente ácido. Sirve para batidos y masas, no para beber.',
        allergens: ['lácteo'],
      },
    ],
  },
  {
    // La leche para hacer queso es la base de la cuajada: no se sustituye.
    ingredient: 'Leche entera pasteurizada',
    functions: ['liquido', 'grasa'],
    substitutes: [],
    avoidWhen: 'Para hacer queso la leche es la base de la cuajada; un sustituto cambia el resultado.',
  },
  {
    ingredient: 'Queso Fresco',
    functions: ['sabor', 'grasa'],
    substitutes: [
      {
        name: 'Queso Manchego o Oaxaca',
        ratio: 1,
        unit: 'g',
        note: 'Es más salado y cremoso. Desmorónalo o córtalo en trocitos; para gratinar funde mejor que el fresco.',
        allergens: ['lácteo'],
      },
    ],
    avoidWhen: 'Si la receta pide queso fresco para untar o para una salsa, el manchego puede cambiar la textura.',
  },
  {
    ingredient: 'Queso Manchego o Oaxaca',
    functions: ['sabor', 'grasa'],
    substitutes: [
      {
        name: 'Queso Fresco',
        ratio: 1,
        unit: 'g',
        note: 'Menos salado y no funde igual; funciona para espolvorear o para comer frío.',
        allergens: ['lácteo'],
      },
    ],
  },
  {
    ingredient: 'Crema ácida',
    functions: ['grasa', 'acido'],
    substitutes: [
      {
        name: 'Yogur natural',
        ratio: 1,
        unit: 'taza',
        note: 'Más ácido y espeso. Si la quieres más líquida, bátelo con una cucharada de leche.',
        allergens: ['lácteo'],
      },
    ],
  },
  {
    ingredient: 'Mantequilla o Aceite',
    functions: ['grasa'],
    substitutes: [
      {
        name: 'Aceite vegetal',
        ratio: 0.75,
        unit: 'cucharada',
        note: 'Sirve para dorar y saltear, pero no aporta el sabor a mantequilla. En repostería delicada puede cambiar la textura.',
      },
    ],
  },
  {
    ingredient: 'Aceite vegetal',
    functions: ['grasa'],
    substitutes: [
      {
        name: 'Mantequilla o Aceite',
        ratio: 1,
        unit: 'cucharada',
        note: 'Derrite la mantequilla y baja el fuego: se quema antes que el aceite.',
        allergens: ['lácteo'],
      },
    ],
  },
  {
    ingredient: 'Harina de trigo',
    functions: ['aglutinante', 'espesante'],
    substitutes: [
      {
        name: 'Avena',
        ratio: 1,
        unit: 'taza',
        note: 'Muele la avena hasta que quede como harina. La masa queda más densa y no sube igual; sirve para hotcakes y panqueques.',
      },
    ],
    avoidWhen: 'No la cambies en panes o pasteles que dependen del gluten para esponjar.',
  },
  {
    ingredient: 'Huevos',
    functions: ['aglutinante'],
    substitutes: [
      {
        name: 'Yogur natural',
        ratio: 0.25,
        unit: 'taza',
        note: 'Solo para repostería: aporta humedad y liga la masa, aunque no da la misma esponja.',
        allergens: ['lácteo'],
      },
    ],
    avoidWhen: 'No sirve para claras a punto de nieve ni para huevos cocidos o estrellados.',
  },
  {
    ingredient: 'Polvo para hornear',
    functions: ['leudante'],
    substitutes: [
      {
        name: 'Bicarbonato',
        ratio: 0.25,
        unit: 'cucharadita',
        note: 'Necesita un ácido para activarse: agrega también media cucharadita de limón o vinagre. Úsalo al momento.',
      },
    ],
  },
  {
    ingredient: 'Limón',
    functions: ['acido', 'sabor'],
    substitutes: [
      {
        name: 'Vinagre blanco',
        ratio: 1,
        unit: 'cucharada',
        note: 'Da la acidez, pero el sabor es más fuerte. Empieza con la mitad y prueba.',
      },
    ],
  },
];
