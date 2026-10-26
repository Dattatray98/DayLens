/**
 * Local Nutrition Database
 *
 * Primary Sources:
 * 1. ICMR-NIN Indian Food Composition Tables (IFCT 2017), National Institute of Nutrition, Hyderabad.
 * 2. USDA FoodData Central (Foundation Foods & Standard Reference Legacy).
 *
 * All nutrient values are standardized per 100g edible portion.
 * Optional `servingWeightG` represents the standard weight in grams for a single piece/count unit.
 */

export interface NutritionData {
    calories: number;        // kcal per 100g edible portion
    protein: number;         // grams protein per 100g edible portion
    servingWeightG?: number; // standard gram weight for 1 count / piece
    source?: 'IFCT' | 'USDA';
}

export const nutritionData: Record<string, NutritionData> = {
    // ------------------------------------------------------------------------
    // A. Cereals & Grains (per 100g edible portion)
    // ------------------------------------------------------------------------
    rice: {
        calories: 130,
        protein: 2.7,
        source: 'USDA', // Cooked white rice
    },
    "raw rice": {
        calories: 360,
        protein: 7.9,
        source: 'IFCT', // Raw milled rice
    },
    "brown rice": {
        calories: 123,
        protein: 2.7,
        source: 'USDA', // Cooked brown rice
    },
    wheat: {
        calories: 340,
        protein: 11.8,
        source: 'IFCT', // Whole wheat flour (atta)
    },
    oats: {
        calories: 389,
        protein: 16.9,
        source: 'USDA', // Rolled oats
    },
    poha: {
        calories: 353,
        protein: 6.6,
        source: 'IFCT', // Beaten / flattened rice
    },
    corn: {
        calories: 96,
        protein: 3.4,
        source: 'USDA', // Boiled sweet corn
    },
    quinoa: {
        calories: 120,
        protein: 4.4,
        source: 'USDA', // Cooked quinoa
    },
    semolina: {
        calories: 360,
        protein: 11.5,
        source: 'IFCT', // Suji / Rava
    },

    // ------------------------------------------------------------------------
    // B. Pulses & Legumes (per 100g dry/raw unless cooked)
    // ------------------------------------------------------------------------
    "moong dal": {
        calories: 348,
        protein: 24.5,
        source: 'IFCT', // Split yellow moong dal
    },
    "masoor dal": {
        calories: 343,
        protein: 25.1,
        source: 'IFCT', // Split red lentil
    },
    "toor dal": {
        calories: 343,
        protein: 22.3,
        source: 'IFCT', // Pigeon pea / Arhar dal
    },
    "urad dal": {
        calories: 350,
        protein: 24.0,
        source: 'IFCT', // Split black gram
    },
    "chana dal": {
        calories: 372,
        protein: 20.8,
        source: 'IFCT', // Split Bengal gram
    },
    "green gram": {
        calories: 334,
        protein: 23.9,
        source: 'IFCT', // Whole moong
    },
    chickpeas: {
        calories: 364,
        protein: 19.3,
        source: 'IFCT', // Kabuli chana / White chickpeas
    },
    rajma: {
        calories: 333,
        protein: 22.9,
        source: 'IFCT', // Kidney beans
    },
    "black beans": {
        calories: 341,
        protein: 21.6,
        source: 'USDA', // Raw black beans
    },
    peas: {
        calories: 81,
        protein: 5.4,
        source: 'IFCT', // Fresh green peas
    },
    dal: {
        calories: 105,
        protein: 6.8,
        source: 'IFCT', // Cooked plain yellow dal
    },

    // ------------------------------------------------------------------------
    // C. Soy & Plant Proteins (per 100g)
    // ------------------------------------------------------------------------
    soya: {
        calories: 446,
        protein: 36.5,
        source: 'IFCT', // Whole raw soybean
    },
    "soya chunks": {
        calories: 345,
        protein: 52.0,
        source: 'IFCT', // Defatted soy chunks
    },
    "soya milk": {
        calories: 54,
        protein: 3.3,
        source: 'USDA', // Plain soy milk
    },
    tofu: {
        calories: 76,
        protein: 8.1,
        source: 'USDA', // Firm tofu
    },
    tempeh: {
        calories: 192,
        protein: 20.3,
        source: 'USDA', // Cooked tempeh
    },

    // ------------------------------------------------------------------------
    // D. Dairy (per 100g)
    // ------------------------------------------------------------------------
    milk: {
        calories: 61,
        protein: 3.2,
        source: 'IFCT', // Whole cow milk
    },
    "toned milk": {
        calories: 58,
        protein: 3.1,
        source: 'IFCT', // Toned milk
    },
    curd: {
        calories: 60,
        protein: 3.5,
        source: 'IFCT', // Whole milk curd / Dahi
    },
    "greek yogurt": {
        calories: 59,
        protein: 10.0,
        source: 'USDA', // Plain nonfat Greek yogurt
    },
    paneer: {
        calories: 265,
        protein: 18.3,
        source: 'IFCT', // Fresh cow paneer
    },
    buttermilk: {
        calories: 40,
        protein: 3.3,
        source: 'IFCT', // Chaas
    },
    cheese: {
        calories: 403,
        protein: 24.9,
        source: 'USDA', // Cheddar cheese
    },

    // ------------------------------------------------------------------------
    // E. Eggs & Meats (per 100g)
    // ------------------------------------------------------------------------
    egg: {
        calories: 155,
        protein: 13.0,
        servingWeightG: 50, // 1 whole medium egg ~50g
        source: 'USDA',
    },
    "egg white": {
        calories: 52,
        protein: 10.9,
        servingWeightG: 33, // 1 egg white ~33g
        source: 'USDA',
    },
    chicken: {
        calories: 239,
        protein: 27.3,
        source: 'USDA', // Roasted chicken meat
    },
    "chicken breast": {
        calories: 165,
        protein: 31.0,
        source: 'USDA', // Cooked skinless chicken breast
    },
    "chicken thigh": {
        calories: 209,
        protein: 24.0,
        source: 'USDA', // Cooked skinless chicken thigh
    },
    mutton: {
        calories: 143,
        protein: 20.6,
        source: 'IFCT', // Lean goat meat
    },
    fish: {
        calories: 97,
        protein: 16.6,
        source: 'IFCT', // Rohu freshwater fish
    },
    tuna: {
        calories: 116,
        protein: 25.5,
        source: 'USDA', // Canned in water, drained
    },

    // ------------------------------------------------------------------------
    // F. Fruits (per 100g raw edible portion)
    // ------------------------------------------------------------------------
    banana: {
        calories: 89,
        protein: 1.1,
        servingWeightG: 100, // 1 medium banana edible portion ~100g
        source: 'IFCT',
    },
    apple: {
        calories: 52,
        protein: 0.3,
        servingWeightG: 150, // 1 medium apple ~150g
        source: 'USDA',
    },
    orange: {
        calories: 47,
        protein: 0.9,
        servingWeightG: 130, // 1 medium orange ~130g
        source: 'USDA',
    },
    mango: {
        calories: 60,
        protein: 0.8,
        servingWeightG: 200, // 1 medium mango edible portion ~200g
        source: 'IFCT',
    },
    grapes: {
        calories: 69,
        protein: 0.7,
        source: 'USDA',
    },
    papaya: {
        calories: 43,
        protein: 0.5,
        source: 'IFCT',
    },
    watermelon: {
        calories: 30,
        protein: 0.6,
        source: 'USDA',
    },
    guava: {
        calories: 68,
        protein: 2.6,
        servingWeightG: 90, // 1 medium guava ~90g
        source: 'IFCT',
    },
    pineapple: {
        calories: 50,
        protein: 0.5,
        source: 'USDA',
    },
    pomegranate: {
        calories: 83,
        protein: 1.7,
        source: 'IFCT',
    },

    // ------------------------------------------------------------------------
    // G. Vegetables (per 100g raw/cooked edible portion)
    // ------------------------------------------------------------------------
    potato: {
        calories: 87,
        protein: 1.9,
        servingWeightG: 130, // 1 medium boiled potato ~130g
        source: 'IFCT',
    },
    "sweet potato": {
        calories: 86,
        protein: 1.6,
        source: 'USDA',
    },
    tomato: {
        calories: 18,
        protein: 0.9,
        servingWeightG: 90, // 1 medium tomato ~90g
        source: 'IFCT',
    },
    onion: {
        calories: 40,
        protein: 1.1,
        servingWeightG: 80, // 1 medium onion ~80g
        source: 'IFCT',
    },
    carrot: {
        calories: 41,
        protein: 0.9,
        servingWeightG: 60, // 1 medium carrot ~60g
        source: 'IFCT',
    },
    spinach: {
        calories: 23,
        protein: 2.9,
        source: 'IFCT', // Palak
    },
    cabbage: {
        calories: 25,
        protein: 1.3,
        source: 'IFCT',
    },
    cauliflower: {
        calories: 25,
        protein: 1.9,
        source: 'IFCT',
    },
    broccoli: {
        calories: 34,
        protein: 2.8,
        source: 'USDA',
    },
    cucumber: {
        calories: 15,
        protein: 0.7,
        source: 'IFCT',
    },
    beetroot: {
        calories: 43,
        protein: 1.6,
        source: 'IFCT',
    },

    // ------------------------------------------------------------------------
    // H. Nuts & Seeds (per 100g raw)
    // ------------------------------------------------------------------------
    almonds: {
        calories: 579,
        protein: 21.2,
        source: 'IFCT', // Badam
    },
    peanuts: {
        calories: 567,
        protein: 25.8,
        source: 'IFCT', // Groundnuts / Mungfali
    },
    walnuts: {
        calories: 654,
        protein: 15.2,
        source: 'IFCT', // Akhrot
    },
    cashews: {
        calories: 553,
        protein: 18.2,
        source: 'IFCT', // Kaju
    },
    "chia seeds": {
        calories: 486,
        protein: 16.5,
        source: 'USDA',
    },
    "flax seeds": {
        calories: 534,
        protein: 18.3,
        source: 'IFCT', // Alsi
    },
    "sunflower seeds": {
        calories: 584,
        protein: 20.8,
        source: 'USDA',
    },
    "pumpkin seeds": {
        calories: 559,
        protein: 30.2,
        source: 'USDA',
    },

    // ------------------------------------------------------------------------
    // I. Common Indian Prepared Foods (per 100g standard)
    // ------------------------------------------------------------------------
    roti: {
        calories: 297,
        protein: 11.0,
        servingWeightG: 35, // 1 medium roti/chapati ~35g
        source: 'IFCT',
    },
    paratha: {
        calories: 320,
        protein: 8.5,
        servingWeightG: 60, // 1 plain tawa paratha ~60g
        source: 'IFCT',
    },
    dosa: {
        calories: 168,
        protein: 3.9,
        servingWeightG: 80, // 1 plain dosa ~80g
        source: 'IFCT',
    },
    idli: {
        calories: 132,
        protein: 4.2,
        servingWeightG: 40, // 1 standard steamed idli ~40g
        source: 'IFCT',
    },
    uttapam: {
        calories: 175,
        protein: 4.5,
        servingWeightG: 100, // 1 medium plain uttapam ~100g
        source: 'IFCT',
    },
    khichdi: {
        calories: 120,
        protein: 4.0,
        source: 'IFCT', // Cooked moong dal khichdi per 100g
    },
    upma: {
        calories: 145,
        protein: 3.5,
        source: 'IFCT', // Cooked semolina upma per 100g
    },
    "besan chilla": {
        calories: 210,
        protein: 10.5,
        servingWeightG: 50, // 1 medium chilla ~50g
        source: 'IFCT',
    },
};

/**
 * Normalization alias map resolving common synonyms to canonical dataset keys.
 */
export const aliasMap: Record<string, string> = {
    // Roti / Indian Breads
    chapati: "roti",
    chapatis: "roti",
    chappathi: "roti",
    phulka: "roti",
    rotis: "roti",
    parotta: "paratha",
    parathas: "paratha",

    // Rice
    "cooked rice": "rice",
    "white rice": "rice",
    "steamed rice": "rice",
    "uncooked rice": "raw rice",

    // Wheat
    atta: "wheat",
    "wheat flour": "wheat",
    gehu: "wheat",

    // Oats
    "rolled oats": "oats",
    oatmeal: "oats",

    // Poha
    aval: "poha",
    "flattened rice": "poha",
    "beaten rice": "poha",

    // Semolina
    suji: "semolina",
    sooji: "semolina",
    rava: "semolina",

    // Corn
    "sweet corn": "corn",
    maize: "corn",

    // Dals & Pulses
    "mung dal": "moong dal",
    "green gram dal": "moong dal",
    "yellow moong dal": "moong dal",
    "yellow dal": "moong dal",
    "red lentil": "masoor dal",
    "red lentils": "masoor dal",
    "arhar dal": "toor dal",
    "tur dal": "toor dal",
    "pigeon pea": "toor dal",
    "pigeon peas": "toor dal",
    "black gram dal": "urad dal",
    "split black gram": "urad dal",
    "bengal gram dal": "chana dal",
    "split bengal gram": "chana dal",
    "whole moong": "green gram",
    "mung bean": "green gram",
    "mung beans": "green gram",
    "kabuli chana": "chickpeas",
    chana: "chickpeas",
    garbanzo: "chickpeas",
    "garbanzo beans": "chickpeas",
    "white chana": "chickpeas",
    "kidney beans": "rajma",
    "kidney bean": "rajma",
    "green peas": "peas",
    matar: "peas",
    "cooked dal": "dal",
    lentil: "dal",
    lentils: "dal",

    // Soy
    soy: "soya",
    soybean: "soya",
    soybeans: "soya",
    "soya bean": "soya",
    "soya beans": "soya",
    mealmaker: "soya chunks",
    "soya chunk": "soya chunks",
    "soy chunks": "soya chunks",
    "soya granules": "soya chunks",

    // Dairy
    "cow milk": "milk",
    "whole milk": "milk",
    "full cream milk": "milk",
    "full-fat milk": "milk",
    dahi: "curd",
    yogurt: "curd",
    yoghurt: "curd",
    "plain curd": "curd",
    "greek yoghurt": "greek yogurt",
    "cottage cheese": "paneer",
    chaas: "buttermilk",
    chhas: "buttermilk",
    cheddar: "cheese",

    // Eggs & Meats
    eggs: "egg",
    "boiled egg": "egg",
    "whole egg": "egg",
    "egg whites": "egg white",
    "chicken meat": "chicken",
    "cooked chicken": "chicken",
    "boneless chicken": "chicken breast",
    "breast piece": "chicken breast",
    goat: "mutton",
    "goat meat": "mutton",
    lamb: "mutton",
    rohu: "fish",
    "fresh fish": "fish",
    "canned tuna": "tuna",

    // Fruits
    bananas: "banana",
    apples: "apple",
    oranges: "orange",
    mangoes: "mango",
    grape: "grapes",
    papayas: "papaya",
    watermelons: "watermelon",
    guavas: "guava",
    pineapples: "pineapple",
    pomegranates: "pomegranate",
    anar: "pomegranate",

    // Vegetables
    potatoes: "potato",
    "boiled potato": "potato",
    "sweet potatoes": "sweet potato",
    tomatoes: "tomato",
    onions: "onion",
    carrots: "carrot",
    palak: "spinach",
    gobi: "cauliflower",
    patta: "cabbage",
    cucumbers: "cucumber",
    kheera: "cucumber",
    beet: "beetroot",

    // Nuts & Seeds
    almond: "almonds",
    badam: "almonds",
    peanut: "peanuts",
    groundnut: "peanuts",
    groundnuts: "peanuts",
    mungfali: "peanuts",
    walnut: "walnuts",
    akhrot: "walnuts",
    cashew: "cashews",
    kaju: "cashews",
    chia: "chia seeds",
    flaxseed: "flax seeds",
    flaxseeds: "flax seeds",
    alsi: "flax seeds",
    "pumpkin seed": "pumpkin seeds",
    "sunflower seed": "sunflower seeds",

    // Prepared Foods
    idlis: "idli",
    dosas: "dosa",
    chilla: "besan chilla",
    cheela: "besan chilla",
};

/**
 * Resolves a user-provided food string to a canonical dataset key.
 */
export function getCanonicalFood(food: string): string | null {
    if (!food) return null;
    const normalized = food.trim().toLowerCase();
    if (nutritionData[normalized]) {
        return normalized;
    }
    const aliased = aliasMap[normalized];
    if (aliased && nutritionData[aliased]) {
        return aliased;
    }
    return null;
}

/**
 * Checks whether a food exists in the local nutrition database.
 */
export function isKnownFood(food: string): boolean {
    return getCanonicalFood(food) !== null;
}

