export const MAIN_CATEGORIES = [
  'Animais',
  'Ferramentas',
  'Cercas e Instalações Rurais',
  'Ração',
] as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export const ANIMAL_SUBCATEGORIES = [
  'Cachorro',
  'Gato',
  'Galinha',
  'Peixe',
  'Outros',
] as const;

export type AnimalSubcategory = (typeof ANIMAL_SUBCATEGORIES)[number];

export const SPECIFIC_ANIMAL_TYPES = [
  'Cachorro',
  'Gato',
  'Galinha',
  'Peixe',
] as const;

export interface DepartmentDefinition {
  name: MainCategory;
  description: string;
  subcategories: readonly string[];
}

export const CATALOG_DEPARTMENTS: readonly DepartmentDefinition[] = [
  {
    name: 'Animais',
    description: 'Cuidados, acessórios, medicamentos e itens por espécie',
    subcategories: ANIMAL_SUBCATEGORIES,
  },
  {
    name: 'Ferramentas',
    description: 'Equipamentos manuais, poda, manutenção e campo',
    subcategories: [
      'Ferramentas Manuais',
      'Jardinagem e Poda',
      'Construção e Manutenção',
      'Pulverizadores e Irrigação',
      'Outros',
    ],
  },
  {
    name: 'Cercas e Instalações Rurais',
    description: 'Arames, cercas elétricas, telas, mourões e estruturas',
    subcategories: [
      'Arames e Telas',
      'Cerca Elétrica',
      'Mourões, Porteiras e Ferragens',
      'Bebedouros e Comedouros',
      'Outros',
    ],
  },
  {
    name: 'Ração',
    description: 'Nutrição completa para pets, aves, peixes e criação rural',
    subcategories: [
      'Cachorro',
      'Gato',
      'Galinha',
      'Peixe',
      'Bovinos e Equinos',
      'Outros',
    ],
  },
];

export interface CategoryAssignableProduct {
  category: string | null;
  additional_categories?: string[] | null;
  subcategory?: string | null;
}

export function normalizeTaxonomyLabel(value: string | null | undefined): string {
  return (value || '').trim();
}

export function getDepartmentSubcategories(department: string): readonly string[] {
  const found = CATALOG_DEPARTMENTS.find((d) => d.name === department);
  return found ? found.subcategories : [];
}

/**
 * Avalia de forma determinística se um produto pertence ao filtro selecionado,
 * respeitando apenas as categorias e subcategorias atribuídas pelo administrador.
 */
export function matchesCatalogCategoryFilter(
  product: CategoryAssignableProduct,
  categoryFilter: string,
  subcategoryFilter: string
): boolean {
  const cat = normalizeTaxonomyLabel(categoryFilter);
  const sub = normalizeTaxonomyLabel(subcategoryFilter);

  if (!cat && !sub) {
    return true;
  }

  const primary = normalizeTaxonomyLabel(product.category);
  const subVal = normalizeTaxonomyLabel(product.subcategory);
  const additional = (product.additional_categories || [])
    .map((c) => normalizeTaxonomyLabel(c))
    .filter(Boolean);

  const hasExactTag = (tag: string) =>
    primary === tag || additional.includes(tag) || subVal === tag;

  const belongsToDepartment = (dept: string) => {
    if (primary === dept || additional.includes(dept)) return true;
    if (dept === 'Animais') {
      return SPECIFIC_ANIMAL_TYPES.some(
        (animal) =>
          primary === animal || additional.includes(animal) || subVal === animal
      );
    }
    return false;
  };

  if (cat && !sub) {
    return belongsToDepartment(cat);
  }

  if (cat === 'Animais' && sub) {
    if (sub === 'Outros') {
      const inAnimais =
        primary === 'Animais' ||
        additional.includes('Animais') ||
        primary === 'Outros' ||
        additional.includes('Animais - Outros');

      if (!inAnimais) return false;

      if (subVal === 'Outros' || additional.includes('Outros')) return true;

      // Produtos dentro de Animais que não pertencem a Cachorro, Gato, Galinha ou Peixe
      const hasSpecificAnimal = SPECIFIC_ANIMAL_TYPES.some(
        (animal) =>
          primary === animal || additional.includes(animal) || subVal === animal
      );
      return !hasSpecificAnimal;
    }

    return hasExactTag(sub);
  }

  if (cat && sub) {
    if (!belongsToDepartment(cat)) return false;
    return subVal === sub || additional.includes(sub) || primary === sub;
  }

  // Filtro apenas por subcategoria sem departamento
  return hasExactTag(sub);
}
