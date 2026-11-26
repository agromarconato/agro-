import { ChevronDown, ChevronRight, LayoutGrid, Percent } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATALOG_DEPARTMENTS, type MainCategory } from '../../shared/catalogTaxonomy';

interface DepartmentNavProps {
  selectedCategory: string;
  selectedSubcategory: string;
  promoOnly: boolean;
  onSelectFilter: (category: string, subcategory: string, promo?: boolean) => void;
}

export function DepartmentNav({
  selectedCategory,
  selectedSubcategory,
  promoOnly,
  onSelectFilter,
}: DepartmentNavProps) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [hoveredDept, setHoveredDept] = useState<MainCategory>('Animais');
  const [quickDropdownDept, setQuickDropdownDept] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpandedDept, setMobileExpandedDept] = useState<string | null>('Animais');
  const navRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
        setQuickDropdownDept(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMegaOpen(false);
        setQuickDropdownDept(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleCloseMega = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMegaOpen(false);
    }, 160);
  };

  const handleChoose = (category: string, subcategory = '', promo = false) => {
    onSelectFilter(category, subcategory, promo);
    setMegaOpen(false);
    setQuickDropdownDept(null);
    setMobileOpen(false);
  };

  const activeDepartmentDef =
    CATALOG_DEPARTMENTS.find((d) => d.name === hoveredDept) || CATALOG_DEPARTMENTS[0];

  return (
    <div
      ref={navRef}
      className="relative z-30 w-full border-b border-emerald-950/20 bg-emerald-950 text-white shadow-sm"
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Desktop: Barra de Departamentos em largura total com animações suaves */}
        <div className="hidden lg:flex w-full items-center gap-1">
          {/* Botão principal Departamentos com painel lateral + subcategorias */}
          <div
            className="relative"
            onMouseEnter={() => {
              clearCloseTimer();
              setQuickDropdownDept(null);
              setMegaOpen(true);
            }}
            onMouseLeave={scheduleCloseMega}
          >
            <button
              type="button"
              onClick={() => setMegaOpen((prev) => !prev)}
              aria-expanded={megaOpen}
              className={`group flex min-h-[52px] cursor-pointer items-center gap-2.5 bg-emerald-900 px-6 text-[15px] font-bold tracking-tight text-white transition-all duration-200 hover:bg-emerald-800 whitespace-nowrap ${
                megaOpen ? 'bg-emerald-800' : ''
              }`}
            >
              <LayoutGrid className="h-4 w-4 text-emerald-200 transition-transform duration-200 group-hover:scale-110" />
              <span>Departamentos</span>
              <ChevronDown
                className={`h-4 w-4 text-emerald-200 transition-transform duration-200 ${
                  megaOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Menu lateral de Departamentos + Subcategorias (estilo Terabyte com paleta Agro Marconato) */}
            {megaOpen && (
              <div
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleCloseMega}
                className="absolute left-0 top-full flex w-[740px] overflow-hidden rounded-b-2xl border border-t-0 border-emerald-950/15 bg-white text-neutral-900 shadow-2xl"
              >
                {/* Coluna esquerda: Departamentos principais */}
                <div className="w-[280px] shrink-0 border-r border-neutral-200 bg-neutral-50 py-2">
                  <button
                    type="button"
                    onClick={() => handleChoose('', '', false)}
                    className={`flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left text-[15px] font-semibold transition-all duration-150 ${
                      !selectedCategory && !selectedSubcategory && !promoOnly
                        ? 'bg-emerald-900 text-white'
                        : 'text-neutral-800 hover:bg-emerald-50 hover:pl-6 hover:text-emerald-950'
                    }`}
                  >
                    <span>Catálogo Geral (Todos)</span>
                  </button>

                  {CATALOG_DEPARTMENTS.map((dept) => {
                    const isFocused = hoveredDept === dept.name;
                    const isActive = selectedCategory === dept.name;
                    return (
                      <button
                        key={dept.name}
                        type="button"
                        onMouseEnter={() => setHoveredDept(dept.name)}
                        onFocus={() => setHoveredDept(dept.name)}
                        onClick={() => handleChoose(dept.name, '')}
                        className={`flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left text-[15px] font-semibold transition-all duration-150 ${
                          isFocused
                            ? 'bg-emerald-900 pl-6 text-white'
                            : isActive
                              ? 'bg-emerald-50 text-emerald-950'
                              : 'text-neutral-800 hover:bg-emerald-50 hover:pl-6 hover:text-emerald-950'
                        }`}
                      >
                        <span className="truncate">{dept.name}</span>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                            isFocused
                              ? 'translate-x-0.5 text-emerald-200'
                              : 'text-neutral-400'
                          }`}
                        />
                      </button>
                    );
                  })}

                  <div className="mt-1 border-t border-neutral-200 pt-1">
                    <button
                      type="button"
                      onClick={() => handleChoose('', '', true)}
                      className={`flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-left text-[15px] font-semibold transition-all duration-150 ${
                        promoOnly
                          ? 'bg-emerald-900 text-white'
                          : 'text-emerald-900 hover:bg-emerald-50 hover:pl-6'
                      }`}
                    >
                      <Percent className="h-4 w-4" />
                      <span>Produtos em Promoção</span>
                    </button>
                  </div>
                </div>

                {/* Coluna direita: Subcategorias do departamento em foco */}
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-emerald-950">
                          {activeDepartmentDef.name}
                        </h3>
                        <p className="mt-0.5 text-sm text-neutral-600">
                          {activeDepartmentDef.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChoose(activeDepartmentDef.name, '')}
                        className="shrink-0 cursor-pointer rounded-lg border border-emerald-900/25 px-3.5 py-1.5 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-900 hover:text-white"
                      >
                        Ver tudo
                      </button>
                    </div>

                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Subcategorias
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      {activeDepartmentDef.subcategories.map((sub) => {
                        const isSelected =
                          selectedCategory === activeDepartmentDef.name &&
                          selectedSubcategory === sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() =>
                              handleChoose(activeDepartmentDef.name, sub)
                            }
                            className={`group flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2 text-left text-sm font-semibold transition-all duration-150 ${
                              isSelected
                                ? 'border-emerald-900 bg-emerald-900 text-white'
                                : 'border-neutral-200 bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-emerald-800 hover:bg-emerald-50 hover:text-emerald-950'
                            }`}
                          >
                            <span>{sub}</span>
                            <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform duration-150 group-hover:translate-x-0.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="mt-5 text-xs text-neutral-500">
                    Todos os itens ativos também ficam listados no Catálogo Geral.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Atalhos rápidos horizontais na barra de departamentos com animação hover */}
          <nav
            aria-label="Departamentos principais"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => handleChoose('', '', false)}
              className={`group relative min-h-[52px] cursor-pointer px-4 text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap ${
                !selectedCategory && !selectedSubcategory && !promoOnly
                  ? 'bg-white/15 text-white'
                  : 'text-emerald-50/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>Catálogo Geral</span>
              <span
                className={`absolute bottom-0 left-3 right-3 h-0.5 origin-left rounded-full bg-emerald-300 transition-transform duration-200 ${
                  !selectedCategory && !selectedSubcategory && !promoOnly
                    ? 'scale-x-100'
                    : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            {CATALOG_DEPARTMENTS.map((dept) => {
              const isSelected = selectedCategory === dept.name;
              const isDropdownOpen = quickDropdownDept === dept.name;

              return (
                <div
                  key={dept.name}
                  className="relative"
                  onMouseEnter={() => {
                    setMegaOpen(false);
                    setQuickDropdownDept(dept.name);
                  }}
                  onMouseLeave={() => setQuickDropdownDept(null)}
                >
                  <button
                    type="button"
                    onClick={() => handleChoose(dept.name, '')}
                    className={`group relative inline-flex min-h-[52px] cursor-pointer items-center gap-1.5 px-4 text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : 'text-emerald-50/90 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{dept.name}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 opacity-80 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                    <span
                      className={`absolute bottom-0 left-3 right-3 h-0.5 origin-left rounded-full bg-emerald-300 transition-transform duration-200 ${
                        isSelected
                          ? 'scale-x-100'
                          : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute left-0 top-full w-64 rounded-b-xl border border-t-0 border-emerald-950/15 bg-white py-2 text-neutral-900 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => handleChoose(dept.name, '')}
                        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
                      >
                        <span>Ver tudo em {dept.name}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="my-1 border-t border-neutral-100" />
                      {dept.subcategories.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleChoose(dept.name, sub)}
                          className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                            selectedCategory === dept.name &&
                            selectedSubcategory === sub
                              ? 'bg-emerald-900 font-semibold text-white'
                              : 'text-neutral-700 hover:bg-emerald-50 hover:pl-5 hover:text-emerald-950'
                          }`}
                        >
                          <span>{sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => handleChoose('', '', !promoOnly)}
              className={`group relative inline-flex min-h-[52px] cursor-pointer items-center gap-1.5 px-4 text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap ${
                promoOnly
                  ? 'bg-white/15 text-white'
                  : 'text-emerald-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Percent className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              <span>Promoções</span>
              <span
                className={`absolute bottom-0 left-3 right-3 h-0.5 origin-left rounded-full bg-emerald-300 transition-transform duration-200 ${
                  promoOnly ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>
          </nav>
        </div>

        {/* Mobile / Tablet: Botão de Departamentos por toque */}
        <div className="flex w-full items-center justify-between py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-bold text-white"
          >
            <LayoutGrid className="h-4 w-4 text-emerald-200" />
            <span>Departamentos</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                mobileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto pl-2">
            {CATALOG_DEPARTMENTS.map((dept) => (
              <button
                key={dept.name}
                type="button"
                onClick={() => handleChoose(dept.name, '')}
                className={`min-h-[38px] shrink-0 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === dept.name
                    ? 'bg-white text-emerald-950'
                    : 'bg-white/10 text-emerald-50 hover:bg-white/20'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Mobile Expansível de Departamentos e Subcategorias */}
      {mobileOpen && (
        <div className="border-t border-white/15 bg-white text-neutral-900 shadow-lg lg:hidden">
          <div className="mx-auto max-w-[1600px] divide-y divide-neutral-200 px-4 py-2">
            <button
              type="button"
              onClick={() => handleChoose('', '', false)}
              className={`flex min-h-[46px] w-full cursor-pointer items-center justify-between px-2 text-left text-sm font-bold ${
                !selectedCategory && !selectedSubcategory && !promoOnly
                  ? 'text-emerald-900'
                  : 'text-neutral-900'
              }`}
            >
              <span>Catálogo Geral (Todos os produtos)</span>
            </button>

            {CATALOG_DEPARTMENTS.map((dept) => {
              const expanded = mobileExpandedDept === dept.name;
              return (
                <div key={dept.name} className="py-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMobileExpandedDept((prev) =>
                        prev === dept.name ? null : dept.name
                      )
                    }
                    className="flex min-h-[46px] w-full cursor-pointer items-center justify-between px-2 text-left text-sm font-bold text-neutral-900"
                  >
                    <span>{dept.name}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-neutral-500 transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {expanded && (
                    <div className="mt-1 grid grid-cols-2 gap-2 pb-3 pl-2 pr-1">
                      <button
                        type="button"
                        onClick={() => handleChoose(dept.name, '')}
                        className={`col-span-2 min-h-[40px] cursor-pointer rounded-lg border px-3 text-left text-xs font-bold ${
                          selectedCategory === dept.name && !selectedSubcategory
                            ? 'border-emerald-900 bg-emerald-900 text-white'
                            : 'border-emerald-900/20 bg-emerald-50 text-emerald-950'
                        }`}
                      >
                        Ver tudo em {dept.name}
                      </button>
                      {dept.subcategories.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleChoose(dept.name, sub)}
                          className={`min-h-[40px] cursor-pointer rounded-lg border px-3 text-left text-xs font-medium ${
                            selectedCategory === dept.name &&
                            selectedSubcategory === sub
                              ? 'border-emerald-900 bg-emerald-900 text-white'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => handleChoose('', '', !promoOnly)}
              className="flex min-h-[46px] w-full cursor-pointer items-center gap-2 px-2 text-left text-sm font-bold text-emerald-900"
            >
              <Percent className="h-4 w-4" />
              <span>Somente promoções</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
