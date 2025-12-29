import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  X, 
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import styles from './Articles.module.css';

const defaultArticle = {
  article_number: '',
  name: '',
  description: '',
  unit_name: 'stk',
  cost_price: '',
  sale_price: '',
  vat_rate: 25,
  category: '',
  is_active: true,
};

const UNIT_OPTIONS = [
  'stk',
  'timer',
  'm',
  'm²',
  'm³',
  'kg',
  'tonn',
  'lass',
  'liter',
  'pakke',
  'sett',
  'løpemeter',
  'par',
  'rull',
  'boks',
];

export default function Articles() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [editedArticles, setEditedArticles] = useState({});
  const [newArticle, setNewArticle] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchArticles();
    }
  }, [profile?.organization_id]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('article_number', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error('Feil ved henting av artikler:', err);
      setError('Kunne ikke hente artikler');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (id, field, value) => {
    setEditedArticles(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || articles.find(a => a.id === id)),
        [field]: value,
      }
    }));
  };

  const hasChanges = (id) => {
    return !!editedArticles[id];
  };

  const saveArticle = async (id) => {
    const edited = editedArticles[id];
    if (!edited) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('articles')
        .update({
          article_number: edited.article_number || null,
          name: edited.name,
          description: edited.description || null,
          unit_name: edited.unit_name || 'stk',
          cost_price: parseFloat(edited.cost_price) || 0,
          sale_price: parseFloat(edited.sale_price) || 0,
          vat_rate: parseFloat(edited.vat_rate) || 25,
          category: edited.category || null,
          is_active: edited.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setArticles(prev => prev.map(a => a.id === id ? { ...a, ...edited } : a));
      setEditedArticles(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      showSuccess('Artikkel lagret');
    } catch (err) {
      console.error('Feil ved lagring:', err);
      setError('Kunne ikke lagre artikkel');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = (id) => {
    setEditedArticles(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const addNewArticle = () => {
    setNewArticle({ ...defaultArticle });
  };

  const saveNewArticle = async () => {
    if (!newArticle.name.trim()) {
      setError('Navn er påkrevd');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('articles')
        .insert({
          organization_id: profile.organization_id,
          article_number: newArticle.article_number || null,
          name: newArticle.name,
          description: newArticle.description || null,
          unit_name: newArticle.unit_name || 'stk',
          cost_price: parseFloat(newArticle.cost_price) || 0,
          sale_price: parseFloat(newArticle.sale_price) || 0,
          vat_rate: parseFloat(newArticle.vat_rate) || 25,
          category: newArticle.category || null,
          is_active: newArticle.is_active,
        })
        .select()
        .single();

      if (error) throw error;

      setArticles(prev => [data, ...prev]);
      setNewArticle(null);
      showSuccess('Artikkel opprettet');
    } catch (err) {
      console.error('Feil ved opprettelse:', err);
      setError('Kunne ikke opprette artikkel');
    } finally {
      setSaving(false);
    }
  };

  const cancelNewArticle = () => {
    setNewArticle(null);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredArticles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredArticles.map(a => a.id));
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmMsg = selectedIds.length === 1 
      ? 'Er du sikker på at du vil slette denne artikkelen?' 
      : `Er du sikker på at du vil slette ${selectedIds.length} artikler?`;
    
    if (!window.confirm(confirmMsg + '\n\nTidligere lagrede tilbud vil ikke påvirkes.')) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('articles')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      setArticles(prev => prev.filter(a => !selectedIds.includes(a.id)));
      setSelectedIds([]);
      showSuccess(`${selectedIds.length} artikkel(er) slettet`);
    } catch (err) {
      console.error('Feil ved sletting:', err);
      setError('Kunne ikke slette artikler');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const filteredArticles = articles.filter(article => {
    const search = searchTerm.toLowerCase();
    return (
      (article.article_number?.toLowerCase() || '').includes(search) ||
      (article.name?.toLowerCase() || '').includes(search) ||
      (article.description?.toLowerCase() || '').includes(search) ||
      (article.category?.toLowerCase() || '').includes(search)
    );
  });

  const getDisplayValue = (article, field) => {
    if (editedArticles[article.id]) {
      return editedArticles[article.id][field];
    }
    return article[field];
  };

  const calculateMargin = (costPrice, salePrice) => {
    const cost = parseFloat(costPrice) || 0;
    const sale = parseFloat(salePrice) || 0;
    if (sale <= 0) return null;
    return ((sale - cost) / sale * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spinner} size={32} />
        <p>Laster artikler...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Package size={24} />
            Artikler
          </h1>
          <span className={styles.count}>{articles.length} artikler</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Søk i artikler..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button onClick={addNewArticle} className={styles.addButton} disabled={newArticle !== null}>
            <Plus size={18} />
            Ny artikkel
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)} className={styles.closeMessage}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          <Check size={18} />
          {successMessage}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedIds.length} valgt</span>
          <button onClick={deleteSelected} className={styles.deleteButton}>
            <Trash2 size={16} />
            Slett valgte
          </button>
          <button onClick={() => setSelectedIds([])} className={styles.cancelButton}>
            Avbryt
          </button>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCol}>
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredArticles.length && filteredArticles.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className={styles.articleNumCol}>Art.nr</th>
              <th className={styles.nameCol}>Navn</th>
              <th className={styles.unitCol}>Enhet</th>
              <th className={styles.priceCol}>Kostpris</th>
              <th className={styles.priceCol}>Salgspris</th>
              <th className={styles.marginCol}>DG%</th>
              <th className={styles.vatCol}>MVA%</th>
              <th className={styles.categoryCol}>Kategori</th>
              <th className={styles.actionsCol}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {/* New Article Row */}
            {newArticle && (
              <tr className={styles.newRow}>
                <td className={styles.checkboxCol}>
                  <Package size={16} className={styles.newIcon} />
                </td>
                <td className={styles.articleNumCol}>
                  <input
                    type="text"
                    value={newArticle.article_number}
                    onChange={(e) => setNewArticle({ ...newArticle, article_number: e.target.value })}
                    placeholder="Art.nr"
                    className={styles.input}
                    autoFocus
                  />
                </td>
                <td className={styles.nameCol}>
                  <input
                    type="text"
                    value={newArticle.name}
                    onChange={(e) => setNewArticle({ ...newArticle, name: e.target.value })}
                    placeholder="Navn *"
                    className={styles.input}
                  />
                </td>
                <td className={styles.unitCol}>
                  <select
                    value={newArticle.unit_name}
                    onChange={(e) => setNewArticle({ ...newArticle, unit_name: e.target.value })}
                    className={styles.select}
                  >
                    {UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </td>
                <td className={styles.priceCol}>
                  <input
                    type="number"
                    value={newArticle.cost_price}
                    onChange={(e) => setNewArticle({ ...newArticle, cost_price: e.target.value })}
                    placeholder="0"
                    className={styles.input}
                  />
                </td>
                <td className={styles.priceCol}>
                  <input
                    type="number"
                    value={newArticle.sale_price}
                    onChange={(e) => setNewArticle({ ...newArticle, sale_price: e.target.value })}
                    placeholder="0"
                    className={styles.input}
                  />
                </td>
                <td className={styles.marginCol}>
                  <span className={styles.marginValue}>
                    {calculateMargin(newArticle.cost_price, newArticle.sale_price) ?? '-'}
                  </span>
                </td>
                <td className={styles.vatCol}>
                  <input
                    type="number"
                    value={newArticle.vat_rate}
                    onChange={(e) => setNewArticle({ ...newArticle, vat_rate: e.target.value })}
                    placeholder="25"
                    className={styles.input}
                  />
                </td>
                <td className={styles.categoryCol}>
                  <input
                    type="text"
                    value={newArticle.category}
                    onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                    placeholder="Kategori"
                    className={styles.input}
                  />
                </td>
                <td className={styles.actionsCol}>
                  <button 
                    onClick={saveNewArticle} 
                    className={styles.saveButton}
                    disabled={saving}
                    title="Lagre"
                  >
                    <Save size={16} />
                  </button>
                  <button 
                    onClick={cancelNewArticle} 
                    className={styles.cancelEditButton}
                    title="Avbryt"
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            )}

            {/* Existing Articles */}
            {filteredArticles.map(article => {
              const isEdited = hasChanges(article.id);
              const displayCost = getDisplayValue(article, 'cost_price');
              const displaySale = getDisplayValue(article, 'sale_price');
              const margin = calculateMargin(displayCost, displaySale);

              return (
                <tr key={article.id} className={`${styles.row} ${isEdited ? styles.editedRow : ''}`}>
                  <td className={styles.checkboxCol}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(article.id)}
                      onChange={() => toggleSelect(article.id)}
                    />
                  </td>
                  <td className={styles.articleNumCol}>
                    <input
                      type="text"
                      value={getDisplayValue(article, 'article_number') || ''}
                      onChange={(e) => handleEditChange(article.id, 'article_number', e.target.value)}
                      placeholder="—"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.nameCol}>
                    <input
                      type="text"
                      value={getDisplayValue(article, 'name') || ''}
                      onChange={(e) => handleEditChange(article.id, 'name', e.target.value)}
                      placeholder="Navn"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.unitCol}>
                    <select
                      value={getDisplayValue(article, 'unit_name') || 'stk'}
                      onChange={(e) => handleEditChange(article.id, 'unit_name', e.target.value)}
                      className={styles.select}
                    >
                      {UNIT_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.priceCol}>
                    <input
                      type="number"
                      value={displayCost ?? ''}
                      onChange={(e) => handleEditChange(article.id, 'cost_price', e.target.value)}
                      placeholder="0"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.priceCol}>
                    <input
                      type="number"
                      value={displaySale ?? ''}
                      onChange={(e) => handleEditChange(article.id, 'sale_price', e.target.value)}
                      placeholder="0"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.marginCol}>
                    <span className={`${styles.marginValue} ${margin && parseFloat(margin) < 0 ? styles.negative : ''}`}>
                      {margin ?? '-'}
                    </span>
                  </td>
                  <td className={styles.vatCol}>
                    <input
                      type="number"
                      value={getDisplayValue(article, 'vat_rate') ?? ''}
                      onChange={(e) => handleEditChange(article.id, 'vat_rate', e.target.value)}
                      placeholder="25"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.categoryCol}>
                    <input
                      type="text"
                      value={getDisplayValue(article, 'category') || ''}
                      onChange={(e) => handleEditChange(article.id, 'category', e.target.value)}
                      placeholder="—"
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.actionsCol}>
                    {isEdited && (
                      <>
                        <button 
                          onClick={() => saveArticle(article.id)} 
                          className={styles.saveButton}
                          disabled={saving}
                          title="Lagre"
                        >
                          <Save size={16} />
                        </button>
                        <button 
                          onClick={() => cancelEdit(article.id)} 
                          className={styles.cancelEditButton}
                          title="Angre"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile Card Layout */}
        <div className={styles.mobileCards}>
          {/* New Article Card (Mobile) */}
          {newArticle && (
            <div className={`${styles.mobileCard} ${styles.newRow}`}>
              <div className={styles.mobileCardHeader}>
                <div className={styles.mobileCardCheckbox}>
                  <Package size={18} className={styles.newIcon} />
                </div>
                <div className={styles.mobileCardTitle}>
                  <input
                    type="text"
                    value={newArticle.name}
                    onChange={(e) => setNewArticle({ ...newArticle, name: e.target.value })}
                    placeholder="Navn på artikkel *"
                    autoFocus
                  />
                  <div className={styles.mobileCardArticleNum}>
                    <input
                      type="text"
                      value={newArticle.article_number}
                      onChange={(e) => setNewArticle({ ...newArticle, article_number: e.target.value })}
                      placeholder="Artikkelnummer"
                    />
                  </div>
                </div>
              </div>
              <div className={styles.mobileCardGrid}>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>Enhet</span>
                  <div className={styles.mobileCardValue}>
                    <select
                      value={newArticle.unit_name}
                      onChange={(e) => setNewArticle({ ...newArticle, unit_name: e.target.value })}
                    >
                      {UNIT_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>MVA %</span>
                  <div className={styles.mobileCardValue}>
                    <input
                      type="number"
                      value={newArticle.vat_rate}
                      onChange={(e) => setNewArticle({ ...newArticle, vat_rate: e.target.value })}
                      placeholder="25"
                    />
                  </div>
                </div>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>Kostpris</span>
                  <div className={styles.mobileCardValue}>
                    <input
                      type="number"
                      value={newArticle.cost_price}
                      onChange={(e) => setNewArticle({ ...newArticle, cost_price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>Salgspris</span>
                  <div className={styles.mobileCardValue}>
                    <input
                      type="number"
                      value={newArticle.sale_price}
                      onChange={(e) => setNewArticle({ ...newArticle, sale_price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>DG %</span>
                  <div className={`${styles.mobileCardMargin} ${
                    calculateMargin(newArticle.cost_price, newArticle.sale_price) >= 0 ? styles.positive : styles.negative
                  }`}>
                    {calculateMargin(newArticle.cost_price, newArticle.sale_price) ?? '-'}%
                  </div>
                </div>
                <div className={styles.mobileCardField}>
                  <span className={styles.mobileCardLabel}>Kategori</span>
                  <div className={styles.mobileCardValue}>
                    <input
                      type="text"
                      value={newArticle.category}
                      onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                      placeholder="Kategori"
                    />
                  </div>
                </div>
              </div>
              <div className={styles.mobileCardActions}>
                <button onClick={saveNewArticle} className={styles.saveButton} disabled={saving}>
                  <Save size={16} />
                  Lagre
                </button>
                <button onClick={cancelNewArticle} className={styles.cancelEditButton}>
                  <X size={16} />
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {/* Existing Articles (Mobile) */}
          {filteredArticles.map(article => {
            const isEdited = hasChanges(article.id);
            const displayCost = getDisplayValue(article, 'cost_price');
            const displaySale = getDisplayValue(article, 'sale_price');
            const margin = calculateMargin(displayCost, displaySale);

            return (
              <div key={article.id} className={`${styles.mobileCard} ${isEdited ? styles.editedRow : ''}`}>
                <div className={styles.mobileCardHeader}>
                  <div className={styles.mobileCardCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(article.id)}
                      onChange={() => toggleSelect(article.id)}
                    />
                  </div>
                  <div className={styles.mobileCardTitle}>
                    <input
                      type="text"
                      value={getDisplayValue(article, 'name') || ''}
                      onChange={(e) => handleEditChange(article.id, 'name', e.target.value)}
                      placeholder="Navn"
                    />
                    <div className={styles.mobileCardArticleNum}>
                      <input
                        type="text"
                        value={getDisplayValue(article, 'article_number') || ''}
                        onChange={(e) => handleEditChange(article.id, 'article_number', e.target.value)}
                        placeholder="Art.nr"
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.mobileCardGrid}>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>Enhet</span>
                    <div className={styles.mobileCardValue}>
                      <select
                        value={getDisplayValue(article, 'unit_name') || 'stk'}
                        onChange={(e) => handleEditChange(article.id, 'unit_name', e.target.value)}
                      >
                        {UNIT_OPTIONS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>MVA %</span>
                    <div className={styles.mobileCardValue}>
                      <input
                        type="number"
                        value={getDisplayValue(article, 'vat_rate') ?? ''}
                        onChange={(e) => handleEditChange(article.id, 'vat_rate', e.target.value)}
                        placeholder="25"
                      />
                    </div>
                  </div>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>Kostpris</span>
                    <div className={styles.mobileCardValue}>
                      <input
                        type="number"
                        value={displayCost ?? ''}
                        onChange={(e) => handleEditChange(article.id, 'cost_price', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>Salgspris</span>
                    <div className={styles.mobileCardValue}>
                      <input
                        type="number"
                        value={displaySale ?? ''}
                        onChange={(e) => handleEditChange(article.id, 'sale_price', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>DG %</span>
                    <div className={`${styles.mobileCardMargin} ${margin && parseFloat(margin) >= 0 ? styles.positive : styles.negative}`}>
                      {margin ?? '-'}%
                    </div>
                  </div>
                  <div className={styles.mobileCardField}>
                    <span className={styles.mobileCardLabel}>Kategori</span>
                    <div className={styles.mobileCardValue}>
                      <input
                        type="text"
                        value={getDisplayValue(article, 'category') || ''}
                        onChange={(e) => handleEditChange(article.id, 'category', e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>
                {isEdited && (
                  <div className={styles.mobileCardActions}>
                    <button onClick={() => saveArticle(article.id)} className={styles.saveButton} disabled={saving}>
                      <Save size={16} />
                      Lagre
                    </button>
                    <button onClick={() => cancelEdit(article.id)} className={styles.cancelEditButton}>
                      <X size={16} />
                      Angre
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredArticles.length === 0 && !newArticle && (
          <div className={styles.emptyState}>
            <Package size={48} strokeWidth={1} />
            <h3>Ingen artikler funnet</h3>
            <p>
              {searchTerm 
                ? 'Prøv å endre søket ditt' 
                : 'Klikk "Ny artikkel" for å legge til din første artikkel'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
