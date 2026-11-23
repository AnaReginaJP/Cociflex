import { GENERATED_IMAGES } from './generatedImages.ts';

export interface CommunityRecipe {
  id: string;
  title: string;
  author: string;
  authorRole: string;
  authorAvatar: string;
  category: string;
  servings: number;
  timeMinutes: number;
  imageUrl: string;
  description: string;
  validationsCount: number; // Max requirement: 3 validations to be certified
  isValidated: boolean; // true when validationsCount >= 3
  validatedBy: string[];
  ingredients: { name: string; amount: string }[];
  steps: { stepNumber: number; title: string; instruction: string; imageUrl?: string }[];
  challengeTag?: string;
  likes: number;
  createdAt: string;
}

export interface InnovationChallenge {
  id: string;
  title: string;
  sponsor: string;
  sponsorLogoText: string;
  badge: string;
  reward: string;
  description: string;
  deadline: string;
  participantsCount: number;
  requirements: string[];
}

export const INITIAL_COMMUNITY_RECIPES: CommunityRecipe[] = [
  {
    id: 'comm-1',
    title: 'Queso Fresco Estilo Morelos Casero',
    author: 'Grecia Ortiz Valle',
    authorRole: 'Biotecnología y Alimentos • Cuernavaca',
    authorAvatar: 'GO',
    category: 'Fermentación Bioartesanal',
    servings: 4,
    timeMinutes: 45,
    imageUrl: GENERATED_IMAGES.fermentation,
    description: 'Receta estandarizada con temperatura controlada a 35°C y sal marina al 2%. La cuajada queda suave y desmoronable.',
    validationsCount: 3,
    isValidated: true,
    validatedBy: ['Carlos Fuentes', 'Marlene Álvarez', 'Jorge Ramos'],
    likes: 42,
    createdAt: 'Hace 2 días',
    challengeTag: 'Reto Bioartesanal 2026',
    ingredients: [
      { name: 'Leche entera pasteurizada', amount: '3 litros' },
      { name: 'Pastilla de cuajo', amount: '1/4 de pastilla' },
      { name: 'Sal de grano fina', amount: '25 g' },
      { name: 'Agua purificada tibia', amount: '50 ml' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Calentamiento a 35°C',
        instruction: 'Calentar la leche en olla de acero inoxidable con termómetro hasta 35°C.',
        imageUrl: GENERATED_IMAGES.fermentation,
      },
      {
        stepNumber: 2,
        title: 'Adición de cuajo y reposo',
        instruction: 'Disolver cuajo en agua tibia, verter y reposar 40 minutos sin perturbar.',
        imageUrl: GENERATED_IMAGES.fermentation,
      },
      {
        stepNumber: 3,
        title: 'Corte y prensado con manta',
        instruction: 'Cortar en cubos de 1 cm, dejar desuerar en manta de cielo y salar.',
        imageUrl: GENERATED_IMAGES.fermentation,
      },
    ],
  },
  {
    id: 'comm-2',
    title: 'Sopa de Tortilla Rescate de Alacena',
    author: 'Carlos Fuentes',
    authorRole: 'Estudiante Foráneo • Tec de Monterrey',
    authorAvatar: 'CF',
    category: 'Tradicional Mexicana',
    servings: 3,
    timeMinutes: 20,
    imageUrl: GENERATED_IMAGES.arrozPollo,
    description: 'Cómo transformar 8 tortillas de hace 4 días y 3 jitomates maduros en una sopa reconfortante de calidad restaurante.',
    validationsCount: 3,
    isValidated: true,
    validatedBy: ['Gretel Pineda', 'Sofía Mendoza', 'Diego Herrera'],
    likes: 38,
    createdAt: 'Hace 4 días',
    challengeTag: 'Reto Cero Desperdicio',
    ingredients: [
      { name: 'Tortillas duras de maíz', amount: '8 piezas' },
      { name: 'Jitomates maduros', amount: '3 piezas' },
      { name: 'Cebolla', amount: '1/4 de pieza' },
      { name: 'Ajo', amount: '1 diente' },
      { name: 'Caldo de pollo en polvo o agua', amount: '3 tazas' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Tiras crujientes en sartén',
        instruction: 'Cortar en tiras finas y freír en 2 cucharadas de aceite caliente hasta dorar parejo.',
      },
      {
        stepNumber: 2,
        title: 'Recaudo de jitomate',
        instruction: 'Licuar jitomate, cebolla y ajo con 1 taza de caldo. Hervir 7 minutos.',
      },
      {
        stepNumber: 3,
        title: 'Servido caliente',
        instruction: 'Poner las tiras en el tazón y bañar con el caldillo hirviendo.',
      },
    ],
  },
  {
    id: 'comm-3',
    title: 'Kéfir de Agua Gasificado con Jamaica y Jengibre',
    author: 'Marlene Álvarez',
    authorRole: 'Entusiasta de la Fermentación • CDMX',
    authorAvatar: 'MA',
    category: 'Fermentación Bioartesanal',
    servings: 4,
    timeMinutes: 25,
    imageUrl: GENERATED_IMAGES.fermentation,
    description: 'Segunda fermentación de tíbicos infusionada con flor de jamaica concentrada y rodajas de jengibre. Burbuja fina natural.',
    validationsCount: 2, // 2/3 - Needs 1 more validation!
    isValidated: false,
    validatedBy: ['Grecia Ortiz', 'Mateo Salazar'],
    likes: 29,
    createdAt: 'Ayer',
    ingredients: [
      { name: 'Kéfir de agua ya colado (1ra fermentación)', amount: '1 litro' },
      { name: 'Concentrado frío de flor de jamaica', amount: '100 ml' },
      { name: 'Jengibre fresco en rodajas', amount: '15 g' },
      { name: 'Azúcar mascabado', amount: '1 cucharadita (para alimentar la burbuja)' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Mezcla en botella swing-top',
        instruction: 'Añadir el concentrado de jamaica y el jengibre a la botella hermética limpia.',
      },
      {
        stepNumber: 2,
        title: 'Llenado con kéfir de agua',
        instruction: 'Verter el kéfir dejando 3 cm de espacio de cabeza de aire.',
      },
      {
        stepNumber: 3,
        title: 'Gasificación controlada (24h)',
        instruction: 'Sellar y dejar a 22°C durante 24 horas. Refrigerar antes de abrir.',
      },
    ],
  },
];

export const INNOVATION_CHALLENGES: InnovationChallenge[] = [
  {
    id: 'reto-cero-desperdicio-2026',
    title: 'Reto Cero Desperdicio: Tortilla y Legumbres',
    sponsor: 'Iniciativa Nacional de Sostenibilidad Alimentaria',
    sponsorLogoText: 'Alianza Cero Merma',
    badge: 'Reto Abierto',
    reward: '$5,000 MXN en kit de cocina profesional + Kit Bioartesanal CociFlex',
    description: 'Crea y publica una receta innovadora usando tortillas del día anterior y sobras de frijoles o lentejas. La receta con más validaciones verificadas por la comunidad ganará el premio de la marca.',
    deadline: '15 de Diciembre 2026',
    participantsCount: 142,
    requirements: [
      'Debe incluir cantidades exactas en gramos o piezas',
      'Fotografías claras de al menos 3 pasos de preparación',
      'Obtener 3 validaciones de otros usuarios que hayan cocinado el platillo',
    ],
  },
  {
    id: 'reto-fermentos-mexicanos',
    title: 'Reto Bioartesanal: Quesos y Cultivos Caseros',
    sponsor: 'CociFlex Lab',
    sponsorLogoText: 'CociFlex Bio',
    badge: 'Reto Científico',
    reward: 'Termómetro digital de grado laboratorio + Set de frascos y mantas estériles',
    description: 'Comparte tu mejor técnica casera para elaborar queso fresco, kéfir o fermentos con rigor de temperatura y pH comprobables.',
    deadline: '28 de Noviembre 2026',
    participantsCount: 89,
    requirements: [
      'Parámetros térmicos especificados en los pasos',
      'Explicación del punto crítico de control',
      'Validación fotográfica del corte de cuajada o textura',
    ],
  },
];

export const PILOT_TESTIMONIALS = [
  {
    quote: 'Como estudiante foráneo, registrar lo que tengo en el refrigerador me ahorra cientos de pesos al mes. En 15 minutos tengo lista la comida con lo que había.',
    author: 'Carlos Fuentes',
    role: 'Estudiante Foráneo / Cocinero Casero',
    avatar: 'CF',
    rating: 5,
  },
  {
    quote: 'Hacer mi propio kéfir y queso fresco estilo Morelos parecía algo peligroso, pero las guías técnicas de CociFlex con control de temperatura me dieron total seguridad.',
    author: 'Marlene Álvarez',
    role: 'Entusiasta de la Fermentación en Casa',
    avatar: 'MA',
    rating: 5,
  },
  {
    quote: 'Participé en el reto de innovación culinaria con ingredientes sobrantes de la semana y gané insumos para fermentación artesanal. ¡Es adictivo y ultra provechoso!',
    author: 'Jorge Ramos',
    role: 'Innovador Culinario Comunitario',
    avatar: 'JR',
    rating: 5,
  },
];

export const FAQS = [
  {
    q: '¿La aplicación es gratuita?',
    a: 'Sí, el acceso al motor de coincidencia con ingredientes de casa, el catálogo de recetas mexicanas tradicionales, los temporizadores y la comunidad abierta son 100% gratuitos.',
  },
  {
    q: '¿Qué incluye la versión Premium de CociFlex?',
    a: 'Desbloquea la Inteligencia Artificial generativa ilimitada para crear recetas personalizadas al milímetro con tus sobras, guías bioartesanales avanzadas de fermentación con análisis de inocuidad, planificación nutricional semanal y acceso prioritario a retos patrocinados con marcas de alimentos.',
  },
  {
    q: '¿Cómo funciona el sistema de validación de 3 likes?',
    a: 'Para garantizar rigor técnico y evitar recetas que no funcionen o desperdicien ingredientes, cada receta compartida por un usuario se publica con estatus provisional hasta que al menos 3 miembros de la comunidad la cocinen y certifiquen su éxito.',
  },
  {
    q: '¿Puedo comprar insumos faltantes desde la app?',
    a: '¡Sí! Al detectar ingredientes faltantes en una receta o frascos de vidrio y cultivos iniciadores para fermentación, la app genera enlaces de compra directa o lista de mandado optimizada para tu supermercado local.',
  },
  {
    q: '¿Cómo funcionan los retos patrocinados por marcas B2B?',
    a: 'Empresas de la industria alimentaria lanzan desafíos de innovación culinaria abierta en CociFlex para descubrir nuevos usos sustentables de sus productos. Los usuarios cocinan, validan y ganan premios en efectivo o canastas de insumos.',
  },
];
