import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2
} from 'lucide-react';
import styles from './Customers.module.css';

export default function Customers() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    if (organization?.id) {
      fetchCustomers();
    } else {
      setLoading(false);
    }
  }, [organization]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCustomers(customers.filter(c => c.id !== id));
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Kunne ikke slette kunde. Sjekk om kunden har tilknyttede jobber.');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div className={`search-input-wrapper ${styles.searchWrapper}`}>
          <Search size={18} />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Søk etter kunder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Link to="/kunder/ny" className="btn btn-primary">
          <Plus size={18} />
          Ny kunde
        </Link>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <h3 className="empty-state-title">
              {searchQuery ? 'Ingen kunder funnet' : 'Ingen kunder ennå'}
            </h3>
            <p className="empty-state-description">
              {searchQuery 
                ? 'Prøv et annet søkeord'
                : 'Legg til din første kunde for å komme i gang.'
              }
            </p>
            {!searchQuery && (
              <Link to="/kunder/ny" className="btn btn-primary">
                <Plus size={18} />
                Legg til kunde
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Kunde</th>
                  <th>E-post</th>
                  <th>Telefon</th>
                  <th>Adresse</th>
                  <th className={styles.actionsColumn}></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id}
                    className={styles.clickableRow}
                    onClick={() => navigate(`/kunder/${customer.id}`)}
                  >
                    <td>
                      <div className={styles.customerName}>{customer.name}</div>
                      {customer.is_private ? (
                        <span className={styles.privateBadge}>
                          Privatkunde
                        </span>
                      ) : customer.org_number ? (
                        <div className={`text-muted ${styles.orgNumber}`}>
                          Org.nr: {customer.org_number}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {customer.email ? (
                        <a 
                          href={`mailto:${customer.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className={styles.contactLink}
                        >
                          <Mail size={14} />
                          {customer.email}
                        </a>
                      ) : '-'}
                    </td>
                    <td>
                      {customer.phone ? (
                        <a 
                          href={`tel:${customer.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className={styles.contactLink}
                        >
                          <Phone size={14} />
                          {customer.phone}
                        </a>
                      ) : '-'}
                    </td>
                    <td>
                      {customer.address ? (
                        <div className={styles.addressCell}>
                          <MapPin size={14} className="text-muted" />
                          <span className={`truncate ${styles.addressText}`}>
                            {customer.address}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button 
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/kunder/${customer.id}/rediger`);
                          }}
                          title="Rediger"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className={`btn btn-ghost btn-icon btn-sm ${styles.deleteBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal(customer);
                          }}
                          title="Slett"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Slett kunde</h3>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Er du sikker på at du vil slette <strong>{deleteModal.name}</strong>?</p>
              <p className="text-muted mt-sm">
                Denne handlingen kan ikke angres.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setDeleteModal(null)}
              >
                Avbryt
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => deleteCustomer(deleteModal.id)}
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
