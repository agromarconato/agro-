import { Pencil, Plus, Trash2, Upload, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ANIMAL_SUBCATEGORIES,
  MAIN_CATEGORIES,
  getDepartmentSubcategories,
} from '../../shared/catalogTaxonomy';
import { PasswordInput } from '../components/PasswordInput';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  ORDER_STATUS_LABELS,
  formatCpfDisplay,
  formatCpfInput,
  formatCurrency,
  formatDateTime,
  formatDeliveryModeInfo,
  formatPaymentSummary,
  formatPhoneInput,
  formatProductCategories,
} from '../lib/format';
import type { AdminUserRow, OrderRecord, OrderStatus, Product, SaleType } from '../types';

const CUSTOM_SUBCATEGORY_SENTINEL = '__custom__';

export function AdminView() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'users'>(
    'products'
  );

  // Produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  // Form produto
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState<string>(MAIN_CATEGORIES[0]);
  const [pAdditionalCategories, setPAdditionalCategories] = useState<string[]>([]);
  const [pSubcategorySelect, setPSubcategorySelect] = useState('');
  const [pCustomSubcategory, setPCustomSubcategory] = useState('');
  const [pSaleType, setPSaleType] = useState<SaleType>('unit');
  const [pPriceUnit, setPPriceUnit] = useState('');
  const [pPromoUnit, setPPromoUnit] = useState('');
  const [pPriceKg, setPPriceKg] = useState('');
  const [pPromoKg, setPPromoKg] = useState('');
  const [pManageStock, setPManageStock] = useState(true);
  const [pStockQty, setPStockQty] = useState('0');
  const [pIsActive, setPIsActive] = useState(true);
  const [pImageUrl, setPImageUrl] = useState('');
  const [pImagePath, setPImagePath] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Pedidos
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);

  // Usuários
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uCpf, setUCpf] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadProducts = async () => {
    setProductsLoading(true);
    setProductError(null);
    try {
      const data = await apiFetch<{ products: Product[] }>(
        '/api/admin/products',
        { token: accessToken }
      );
      setProducts(data.products);
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Erro ao listar produtos.'
      );
    } finally {
      setProductsLoading(false);
    }
  };

  const loadOrders = async (statusFilter = orderStatusFilter) => {
    setOrdersLoading(true);
    try {
      const query = statusFilter
        ? `?status=${encodeURIComponent(statusFilter)}`
        : '';
      const data = await apiFetch<{ orders: OrderRecord[] }>(
        `/api/admin/orders${query}`,
        { token: accessToken }
      );
      setOrders(data.orders);
    } catch {
      // erro tratado na interface
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users', {
        token: accessToken,
      });
      setUsers(data.users);
    } catch {
      // erro tratado na interface
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') loadProducts();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'users') loadUsers();
  }, [activeTab, accessToken]);

  const subcategoryOptions = useMemo(() => {
    const set = new Set<string>([
      ...getDepartmentSubcategories(pCategory),
      ...ANIMAL_SUBCATEGORIES,
    ]);
    return Array.from(set);
  }, [pCategory]);

  const additionalCategoryOptions = useMemo(() => {
    const candidates: string[] = [...MAIN_CATEGORIES, ...ANIMAL_SUBCATEGORIES];
    return candidates.filter((item) => item !== pCategory);
  }, [pCategory]);

  const resolvedSubcategory =
    pSubcategorySelect === CUSTOM_SUBCATEGORY_SENTINEL
      ? pCustomSubcategory.trim()
      : pSubcategorySelect.trim();

  const toggleAdditionalCategory = (cat: string) => {
    setPAdditionalCategories((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
    );
  };

  const openNewProductForm = () => {
    setEditingProduct(null);
    setPName('');
    setPDesc('');
    setPCategory(MAIN_CATEGORIES[0]);
    setPAdditionalCategories([]);
    setPSubcategorySelect('');
    setPCustomSubcategory('');
    setPSaleType('unit');
    setPPriceUnit('');
    setPPromoUnit('');
    setPPriceKg('');
    setPPromoKg('');
    setPManageStock(true);
    setPStockQty('0');
    setPIsActive(true);
    setPImageUrl('');
    setPImagePath('');
    setProductError(null);
    setProductSuccess(null);
    setShowProductForm(true);
  };

  const openEditProductForm = (prod: Product) => {
    const primary = prod.category || MAIN_CATEGORIES[0];
    const knownSubs = new Set<string>([
      ...getDepartmentSubcategories(primary),
      ...ANIMAL_SUBCATEGORIES,
    ]);
    const existingSub = (prod.subcategory || '').trim();

    setEditingProduct(prod);
    setPName(prod.name);
    setPDesc(prod.description);
    setPCategory(primary);
    setPAdditionalCategories(
      Array.isArray(prod.additional_categories)
        ? prod.additional_categories.filter((c) => c && c !== primary)
        : []
    );
    if (!existingSub) {
      setPSubcategorySelect('');
      setPCustomSubcategory('');
    } else if (knownSubs.has(existingSub)) {
      setPSubcategorySelect(existingSub);
      setPCustomSubcategory('');
    } else {
      setPSubcategorySelect(CUSTOM_SUBCATEGORY_SENTINEL);
      setPCustomSubcategory(existingSub);
    }
    setPSaleType(prod.sale_type);
    setPPriceUnit(prod.price_unit !== null ? String(prod.price_unit) : '');
    setPPromoUnit(
      prod.promo_price_unit !== null ? String(prod.promo_price_unit) : ''
    );
    setPPriceKg(prod.price_kg !== null ? String(prod.price_kg) : '');
    setPPromoKg(
      prod.promo_price_kg !== null ? String(prod.promo_price_kg) : ''
    );
    setPManageStock(prod.manage_stock);
    setPStockQty(prod.stock_quantity !== null ? String(prod.stock_quantity) : '0');
    setPIsActive(prod.is_active);
    setPImageUrl(prod.image_url || '');
    setPImagePath(prod.image_path || '');
    setProductError(null);
    setProductSuccess(null);
    setShowProductForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductError(null);
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiFetch<{ imageUrl: string; imagePath: string }>(
        '/api/admin/products/upload-image',
        {
          method: 'POST',
          token: accessToken,
          body: formData,
        }
      );
      setPImageUrl(res.imageUrl);
      setPImagePath(res.imagePath);
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Erro ao enviar imagem.'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError(null);
    setProductSuccess(null);

    if (!pCategory.trim()) {
      setProductError('Selecione a categoria principal do produto.');
      return;
    }

    setSavingProduct(true);

    const toNum = (val: string) => {
      const trimmed = val.trim().replace(',', '.');
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    };

    const normalizedPrimary = pCategory.trim();
    const cleanedAdditional = Array.from(
      new Set(
        pAdditionalCategories
          .map((c) => c.trim())
          .filter((c) => c && c !== normalizedPrimary)
      )
    );

    const body = {
      name: pName.trim(),
      description: pDesc.trim(),
      category: normalizedPrimary,
      additionalCategories: cleanedAdditional,
      subcategory: resolvedSubcategory || null,
      imageUrl: pImageUrl || null,
      imagePath: pImagePath || null,
      saleType: pSaleType,
      priceUnit: pSaleType === 'kg' ? null : toNum(pPriceUnit),
      promoPriceUnit: pSaleType === 'kg' ? null : toNum(pPromoUnit),
      priceKg: pSaleType === 'unit' ? null : toNum(pPriceKg),
      promoPriceKg: pSaleType === 'unit' ? null : toNum(pPromoKg),
      manageStock: pManageStock,
      stockQuantity: pManageStock ? toNum(pStockQty) ?? 0 : null,
      isActive: pIsActive,
    };

    try {
      if (editingProduct) {
        const res = await apiFetch<{ product: Product }>(
          `/api/admin/products/${editingProduct.id}`,
          {
            method: 'PATCH',
            token: accessToken,
            body,
          }
        );
        setShowProductForm(false);
        await loadProducts();
        setProductSuccess(
          `Produto "${res.product.name}" atualizado e salvo no banco de dados.`
        );
      } else {
        const res = await apiFetch<{ product: Product }>('/api/admin/products', {
          method: 'POST',
          token: accessToken,
          body,
        });
        setShowProductForm(false);
        await loadProducts();
        setProductSuccess(
          `Produto "${res.product.name}" cadastrado e gravado no banco de dados.`
        );
      }
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Erro ao salvar produto.'
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    setProductError(null);
    setProductSuccess(null);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/admin/products/${prod.id}`,
        {
          method: 'DELETE',
          token: accessToken,
        }
      );
      await loadProducts();
      setProductSuccess(res.message);
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Erro ao excluir/desativar produto.'
      );
    }
  };

  const handleOrderStatusChange = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    setOrderFeedback(null);
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: { status: newStatus },
      });
      setOrderFeedback('Status do pedido atualizado.');
      await loadOrders();
    } catch (err) {
      setOrderFeedback(
        err instanceof Error ? err.message : 'Erro ao atualizar pedido.'
      );
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);
    setCreatingAdmin(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        token: accessToken,
        body: {
          fullName: uName.trim(),
          email: uEmail.trim(),
          cpf: uCpf,
          phone: uPhone,
          password: uPassword,
        },
      });
      setUName('');
      setUEmail('');
      setUCpf('');
      setUPhone('');
      setUPassword('');
      setUserSuccess(
        'Administrador criado. Ele precisará alterar a senha inicial no primeiro acesso.'
      );
      await loadUsers();
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Erro ao criar administrador.'
      );
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleToggleUserActive = async (target: AdminUserRow) => {
    setUserError(null);
    try {
      await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { isActive: !target.is_active },
      });
      await loadUsers();
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Erro ao atualizar usuário.'
      );
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Painel Administrativo
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Logado como <strong>{user?.fullName}</strong> (
            {isSuperAdmin ? 'Administrador Máximo' : 'Administrador'})
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {(
            [
              { id: 'products', label: 'Produtos' },
              { id: 'orders', label: 'Pedidos' },
              { id: 'users', label: 'Usuários' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[38px] cursor-pointer rounded-md px-4 text-sm font-semibold transition-colors ${
                activeTab === t.id
                  ? 'bg-emerald-900 text-white'
                  : 'text-neutral-700 hover:text-neutral-950'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ABA PRODUTOS */}
      {activeTab === 'products' && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-neutral-900">
              Gerenciar Produtos ({products.length})
            </h2>
            <button
              type="button"
              onClick={openNewProductForm}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950"
            >
              <Plus className="h-4 w-4" />
              Novo produto
            </button>
          </div>

          {productError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {productError}
            </div>
          )}

          {productSuccess && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {productSuccess}
            </div>
          )}

          {showProductForm && (
            <form
              onSubmit={handleSaveProduct}
              className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-6"
            >
              <h3 className="text-base font-bold text-neutral-900">
                {editingProduct ? 'Editar produto' : 'Cadastrar novo produto'}
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-800">
                    Nome do produto
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Ex: Ração Premium Cães Adultos 15kg"
                    className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Categoria principal
                  </label>
                  <select
                    required
                    value={pCategory}
                    onChange={(e) => {
                      const nextPrimary = e.target.value;
                      setPCategory(nextPrimary);
                      setPAdditionalCategories((prev) =>
                        prev.filter((c) => c !== nextPrimary)
                      );
                    }}
                    className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  >
                    {MAIN_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {pCategory &&
                      !(MAIN_CATEGORIES as readonly string[]).includes(
                        pCategory
                      ) && <option value={pCategory}>{pCategory} (atual)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Subcategoria ou tipo específico (opcional)
                  </label>
                  <select
                    value={pSubcategorySelect}
                    onChange={(e) => setPSubcategorySelect(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  >
                    <option value="">Sem subcategoria específica</option>
                    {subcategoryOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value={CUSTOM_SUBCATEGORY_SENTINEL}>
                      Outro (digitar manualmente)
                    </option>
                  </select>
                  {pSubcategorySelect === CUSTOM_SUBCATEGORY_SENTINEL && (
                    <input
                      type="text"
                      value={pCustomSubcategory}
                      onChange={(e) => setPCustomSubcategory(e.target.value)}
                      placeholder="Digite a subcategoria ou tipo..."
                      className="mt-2 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <span className="block text-xs font-semibold text-neutral-800">
                    Categorias adicionais (opcional — ex.: marque &quot;Cachorro&quot; para ração de cachorro aparecer também em Animais &rarr; Cachorro)
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {additionalCategoryOptions.map((cat) => {
                      const checked = pAdditionalCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            checked
                              ? 'border-emerald-900 bg-emerald-900 text-white'
                              : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdditionalCategory(cat)}
                            className="sr-only"
                          />
                          <span>{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-emerald-900">
                    Onde aparecerá no catálogo:{' '}
                    <strong>
                      Catálogo Geral
                      {[
                        pCategory,
                        ...pAdditionalCategories.filter((c) => c !== pCategory),
                        resolvedSubcategory,
                      ]
                        .filter(Boolean)
                        .map((label) => `, ${label}`)
                        .join('')}
                    </strong>
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-800">
                    Descrição completa e indicação de uso
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={pDesc}
                    onChange={(e) => setPDesc(e.target.value)}
                    placeholder="Explique para quais animais o produto é indicado, peso, composição..."
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Tipo de venda
                  </label>
                  <select
                    value={pSaleType}
                    onChange={(e) => setPSaleType(e.target.value as SaleType)}
                    className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  >
                    <option value="unit">Por unidade</option>
                    <option value="kg">Por quilo (kg)</option>
                    <option value="both">Unidade e Quilo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Imagem do produto (envio direto para Supabase Storage)
                  </label>
                  <div className="mt-1 flex items-center gap-3">
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-emerald-900 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                      <Upload className="h-4 w-4" />
                      {uploadingImage ? 'Enviando...' : 'Escolher arquivo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="sr-only"
                      />
                    </label>
                    {pImageUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={pImageUrl}
                          alt="Pré-visualização"
                          referrerPolicy="no-referrer"
                          className="h-11 w-14 rounded-md border border-neutral-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPImageUrl('');
                            setPImagePath('');
                          }}
                          className="cursor-pointer text-xs font-medium text-red-700 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(pSaleType === 'unit' || pSaleType === 'both') && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800">
                        Preço normal por unidade (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={pPriceUnit}
                        onChange={(e) => setPPriceUnit(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800">
                        Preço promocional por unidade (R$ - opcional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={pPromoUnit}
                        onChange={(e) => setPPromoUnit(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                      />
                    </div>
                  </>
                )}

                {(pSaleType === 'kg' || pSaleType === 'both') && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800">
                        Preço normal por quilo (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={pPriceKg}
                        onChange={(e) => setPPriceKg(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800">
                        Preço promocional por quilo (R$ - opcional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={pPromoKg}
                        onChange={(e) => setPPromoKg(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={pManageStock}
                      onChange={(e) => setPManageStock(e.target.checked)}
                    />
                    Controlar estoque
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={pIsActive}
                      onChange={(e) => setPIsActive(e.target.checked)}
                    />
                    Visível no catálogo
                  </label>
                </div>

                {pManageStock && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800">
                      Quantidade em estoque
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={pStockQty}
                      onChange={(e) => setPStockQty(e.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={savingProduct || uploadingImage}
                  className="min-h-[42px] cursor-pointer rounded-lg bg-emerald-900 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-950 disabled:opacity-50"
                >
                  {savingProduct ? 'Salvando...' : 'Salvar produto'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="min-h-[42px] cursor-pointer rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {productsLoading && (
              <p className="p-6 text-sm text-neutral-500">
                Carregando produtos...
              </p>
            )}
            {!productsLoading && products.length === 0 && (
              <p className="p-6 text-sm text-neutral-500">
                Nenhum produto cadastrado ainda.
              </p>
            )}
            {products.map((prod) => (
              <div
                key={prod.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    <ProductImage
                      src={prod.image_url}
                      alt={prod.name}
                      className="h-full w-full"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      {formatProductCategories(prod).length > 0 && (
                        <span>{formatProductCategories(prod).join(' · ')}</span>
                      )}
                      {formatProductCategories(prod).length > 0 && (
                        <span>·</span>
                      )}
                      <span
                        className={
                          prod.is_active
                            ? 'font-semibold text-emerald-800'
                            : 'font-semibold text-neutral-500'
                        }
                      >
                        {prod.is_active ? 'Ativo' : 'Desativado'}
                      </span>
                      {prod.manage_stock && (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            Estoque: {prod.stock_quantity ?? 0}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="font-bold text-neutral-900">{prod.name}</p>
                    <p className="font-mono tabular-nums text-xs text-neutral-600">
                      {prod.price_unit !== null &&
                        `Un: ${formatCurrency(prod.promo_price_unit ?? prod.price_unit)} `}
                      {prod.price_kg !== null &&
                        `Kg: ${formatCurrency(prod.promo_price_kg ?? prod.price_kg)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditProductForm(prod)}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(prod)}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ABA PEDIDOS */}
      {activeTab === 'orders' && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-neutral-900">
              Pedidos Recebidos ({orders.length})
            </h2>
            <select
              value={orderStatusFilter}
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                loadOrders(e.target.value);
              }}
              aria-label="Filtrar pedidos por status"
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
            >
              <option value="">Todos os status</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {orderFeedback && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {orderFeedback}
            </div>
          )}

          {ordersLoading ? (
            <p className="mt-6 text-sm text-neutral-500">Carregando pedidos...</p>
          ) : orders.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">
              Nenhum pedido encontrado.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((order) => {
                const payment = Array.isArray(order.payments)
                  ? order.payments[0]
                  : order.payments;
                const paymentSummary = formatPaymentSummary(payment);
                const deliveryInfo = formatDeliveryModeInfo(order);

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-neutral-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-4">
                      <div>
                        <p className="font-mono tabular-nums text-sm font-bold text-neutral-900">
                          Pedido #{order.order_number} ·{' '}
                          {formatDateTime(order.created_at)}
                        </p>
                        <p className="mt-1 text-sm text-neutral-800">
                          Cliente: <strong>{order.customer_name}</strong> · CPF:{' '}
                          <span className="font-mono tabular-nums">
                            {formatCpfDisplay(order.customer_cpf || '')}
                          </span>{' '}
                          · Tel: {order.customer_phone}
                        </p>
                        <p className="mt-1 text-xs text-neutral-700">
                          <strong>{deliveryInfo.label}:</strong>{' '}
                          {deliveryInfo.detail}
                        </p>
                        {order.notes && (
                          <p className="mt-1 text-xs text-neutral-700">
                            Observação: {order.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleOrderStatusChange(
                              order.id,
                              e.target.value as OrderStatus
                            )
                          }
                          aria-label={`Alterar status do pedido #${order.order_number}`}
                          className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-900"
                        >
                          {Object.entries(ORDER_STATUS_LABELS).map(
                            ([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                        <span className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                          Total: {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-neutral-700">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between py-1"
                        >
                          <span>
                            {item.quantity}{' '}
                            {item.unit_mode === 'kg' ? 'kg' : 'un'} ×{' '}
                            {item.product_name} (
                            {formatCurrency(item.unit_price)})
                          </span>
                          <span className="font-mono tabular-nums font-semibold">
                            {formatCurrency(item.line_total)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {paymentSummary && (
                      <div className="mt-3 space-y-0.5 border-t border-neutral-100 pt-3 text-xs text-neutral-700">
                        <p>
                          Pagamento: <strong>{paymentSummary.primary}</strong> ·{' '}
                          <span className="font-medium">
                            {paymentSummary.statusLabel}
                          </span>
                          {payment?.provider_reference
                            ? ` · Ref. gateway: ${payment.provider_reference}`
                            : ''}
                        </p>
                        {paymentSummary.extras.length > 0 && (
                          <p className="text-neutral-600">
                            {paymentSummary.extras.join(' · ')}
                          </p>
                        )}
                        {paymentSummary.note && (
                          <p className="text-neutral-500">
                            {paymentSummary.note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ABA USUÁRIOS */}
      {activeTab === 'users' && (
        <section className="mt-6 space-y-6">
          {isSuperAdmin ? (
            <form
              onSubmit={handleCreateAdmin}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-6"
            >
              <div className="flex items-center gap-2 text-emerald-950">
                <UserPlus className="h-5 w-5" />
                <h2 className="text-base font-bold">
                  Cadastrar Novo Administrador
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-600">
                Apenas o administrador máximo pode criar novas contas administrativas.
              </p>

              {userError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {userError}
                </div>
              )}
              {userSuccess && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  {userSuccess}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  placeholder="Nome completo"
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                />
                <input
                  type="email"
                  required
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="E-mail"
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                />
                <input
                  type="text"
                  required
                  value={uCpf}
                  onChange={(e) => setUCpf(formatCpfInput(e.target.value))}
                  placeholder="CPF (000.000.000-00)"
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                />
                <input
                  type="tel"
                  required
                  value={uPhone}
                  onChange={(e) => setUPhone(formatPhoneInput(e.target.value))}
                  placeholder="Telefone"
                  className="h-11 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm"
                />
                <PasswordInput
                  required
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="Senha inicial forte"
                  wrapperClassName="sm:col-span-2"
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={creatingAdmin}
                className="mt-4 min-h-[42px] cursor-pointer rounded-lg bg-emerald-900 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-950 disabled:opacity-50"
              >
                {creatingAdmin ? 'Criando...' : 'Criar administrador'}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              A criação e alteração de administradores é restrita ao Administrador Máximo.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="px-4 py-3 font-semibold">CPF</th>
                  <th className="px-4 py-3 font-semibold">Papel</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 font-semibold">Ação</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {usersLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-neutral-500">
                      Carregando usuários...
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {u.full_name}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-neutral-600">
                      {formatCpfDisplay(u.cpf)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {u.role === 'super_admin'
                        ? 'Admin Máximo'
                        : u.role === 'admin'
                          ? 'Administrador'
                          : 'Cliente'}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        {u.role !== 'super_admin' && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(u)}
                            className="cursor-pointer text-xs font-semibold text-emerald-900 hover:underline"
                          >
                            {u.is_active ? 'Desativar' : 'Reativar'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
