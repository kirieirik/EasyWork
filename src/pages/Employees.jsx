import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Plus,
  Mail,
  Phone,
  Crown,
  Shield,
  User,
  MoreVertical,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  X
} from 'lucide-react';
import styles from './Employees.module.css';

const roleLabels = {
  owner: { label: 'Eier', icon: Crown, color: 'gold' },
  admin: { label: 'Administrator', icon: Shield, color: 'blue' },
  employee: { label: 'Ansatt', icon: User, color: 'gray' }
};

const statusLabels = {
  pending: { label: 'Venter', icon: Clock, color: 'warning' },
  accepted: { label: 'Akseptert', icon: CheckCircle, color: 'success' },
  expired: { label: 'Utløpt', icon: XCircle, color: 'danger' },
  cancelled: { label: 'Kansellert', icon: XCircle, color: 'danger' }
};

export default function Employees() {
  const { organization, profile, isOwner, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canManage = isOwner || isAdmin;

  useEffect(() => {
    if (organization?.id) {
      fetchEmployees();
      if (canManage) {
        fetchInvitations();
      }
    }
  }, [organization, canManage]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organization.id)
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!inviteEmail.trim()) {
      setError('E-postadresse er påkrevd');
      return;
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setError('Ugyldig e-postadresse');
      return;
    }

    // Check if already invited
    const existingInvite = invitations.find(i => i.email.toLowerCase() === inviteEmail.toLowerCase());
    if (existingInvite) {
      setError('Denne e-postadressen er allerede invitert');
      return;
    }

    // Check if already an employee
    const existingEmployee = employees.find(e => e.email?.toLowerCase() === inviteEmail.toLowerCase());
    if (existingEmployee) {
      setError('Denne personen er allerede ansatt i bedriften');
      return;
    }

    setSending(true);

    try {
      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          organization_id: organization.id,
          email: inviteEmail.toLowerCase(),
          role: inviteRole,
          invited_by: profile.id
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          to: inviteEmail,
          token: invitation.token,
          organizationName: organization.name,
          inviterName: profile.full_name || profile.email,
          inviterEmail: profile.email,
          role: inviteRole
        }
      });

      if (emailError) {
        console.error('Email error:', emailError);
        // Don't throw - invitation is created, just email failed
      }

      setInvitations([invitation, ...invitations]);
      setInviteEmail('');
      setInviteRole('employee');
      setSuccess('Invitasjon sendt!');
      
      setTimeout(() => {
        setShowInviteModal(false);
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error creating invitation:', err);
      setError(err.message || 'Kunne ikke sende invitasjon');
    } finally {
      setSending(false);
    }
  };

  const cancelInvitation = async (invitationId) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;
      setInvitations(invitations.filter(i => i.id !== invitationId));
    } catch (err) {
      console.error('Error cancelling invitation:', err);
    }
  };

  const removeEmployee = async (employeeId) => {
    if (!confirm('Er du sikker på at du vil fjerne denne ansatte?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'employee' })
        .eq('id', employeeId);

      if (error) throw error;
      setEmployees(employees.filter(e => e.id !== employeeId));
    } catch (err) {
      console.error('Error removing employee:', err);
    }
  };

  const updateEmployeeRole = async (employeeId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', employeeId);

      if (error) throw error;
      setEmployees(employees.map(e => 
        e.id === employeeId ? { ...e, role: newRole } : e
      ));
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ansatte</h1>
          <p className={styles.subtitle}>
            {employees.length} {employees.length === 1 ? 'ansatt' : 'ansatte'} i {organization?.name}
          </p>
        </div>
        {canManage && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowInviteModal(true)}
          >
            <Plus size={18} />
            Inviter ansatt
          </button>
        )}
      </div>

      {/* Pending Invitations */}
      {canManage && invitations.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Clock size={18} />
            Ventende invitasjoner ({invitations.length})
          </h2>
          <div className={styles.invitationsList}>
            {invitations.map(invitation => (
              <div key={invitation.id} className={styles.invitationCard}>
                <div className={styles.invitationInfo}>
                  <Mail size={16} className={styles.invitationIcon} />
                  <div>
                    <span className={styles.invitationEmail}>{invitation.email}</span>
                    <span className={styles.invitationRole}>
                      {invitation.role === 'admin' ? 'Administrator' : 'Ansatt'}
                    </span>
                  </div>
                </div>
                <div className={styles.invitationMeta}>
                  <span className={styles.invitationDate}>
                    Utløper {new Date(invitation.expires_at).toLocaleDateString('nb-NO')}
                  </span>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => cancelInvitation(invitation.id)}
                    title="Kanseller invitasjon"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employees List */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Users size={18} />
          Ansatte
        </h2>
        
        {employees.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <h3 className="empty-state-title">Ingen ansatte ennå</h3>
              <p className="empty-state-description">
                Inviter dine første ansatte for å komme i gang.
              </p>
              {canManage && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowInviteModal(true)}
                >
                  <Plus size={18} />
                  Inviter ansatt
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.employeesGrid}>
            {employees.map(employee => {
              const RoleIcon = roleLabels[employee.role]?.icon || User;
              const isCurrentUser = employee.id === profile.id;
              const canEdit = canManage && !isCurrentUser && employee.role !== 'owner';

              return (
                <div key={employee.id} className={styles.employeeCard}>
                  <div className={styles.employeeHeader}>
                    <div className={styles.avatar}>
                      {employee.avatar_url ? (
                        <img src={employee.avatar_url} alt={employee.full_name} />
                      ) : (
                        <span>{getInitials(employee.full_name)}</span>
                      )}
                    </div>
                    <div className={styles.employeeInfo}>
                      <h3 className={styles.employeeName}>
                        {employee.full_name || 'Uten navn'}
                        {isCurrentUser && <span className={styles.youBadge}>deg</span>}
                      </h3>
                      <span className={`${styles.roleBadge} ${styles[roleLabels[employee.role]?.color]}`}>
                        <RoleIcon size={12} />
                        {roleLabels[employee.role]?.label}
                      </span>
                    </div>
                    {canEdit && (
                      <div className={styles.employeeActions}>
                        <select
                          value={employee.role}
                          onChange={(e) => updateEmployeeRole(employee.id, e.target.value)}
                          className={styles.roleSelect}
                        >
                          <option value="employee">Ansatt</option>
                          <option value="admin">Administrator</option>
                        </select>
                        <button
                          className={styles.removeBtn}
                          onClick={() => removeEmployee(employee.id)}
                          title="Fjern fra bedrift"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.employeeDetails}>
                    {employee.email && (
                      <div className={styles.detailItem}>
                        <Mail size={14} />
                        <a href={`mailto:${employee.email}`}>{employee.email}</a>
                      </div>
                    )}
                    {employee.phone && (
                      <div className={styles.detailItem}>
                        <Phone size={14} />
                        <a href={`tel:${employee.phone}`}>{employee.phone}</a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowInviteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Inviter ansatt</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowInviteModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {success ? (
              <div className={styles.successState}>
                <CheckCircle size={48} />
                <h3>Invitasjon sendt!</h3>
                <p>En e-post er sendt til {inviteEmail}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className={styles.modalContent}>
                <p className={styles.modalDescription}>
                  Skriv inn e-postadressen til personen du vil invitere. De vil motta en e-post med en lenke for å bli med i {organization?.name}.
                </p>

                {error && (
                  <div className={styles.errorMessage}>
                    {error}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>E-postadresse</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="navn@eksempel.no"
                    className={styles.input}
                    autoFocus
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Rolle</label>
                  <div className={styles.roleOptions}>
                    <label className={`${styles.roleOption} ${inviteRole === 'employee' ? styles.selected : ''}`}>
                      <input
                        type="radio"
                        name="role"
                        value="employee"
                        checked={inviteRole === 'employee'}
                        onChange={(e) => setInviteRole(e.target.value)}
                      />
                      <User size={20} />
                      <div>
                        <span className={styles.roleOptionTitle}>Ansatt</span>
                        <span className={styles.roleOptionDesc}>Kan se og redigere jobber, kunder og tilbud</span>
                      </div>
                    </label>
                    <label className={`${styles.roleOption} ${inviteRole === 'admin' ? styles.selected : ''}`}>
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={inviteRole === 'admin'}
                        onChange={(e) => setInviteRole(e.target.value)}
                      />
                      <Shield size={20} />
                      <div>
                        <span className={styles.roleOptionTitle}>Administrator</span>
                        <span className={styles.roleOptionDesc}>Full tilgang inkludert ansatthåndtering</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => setShowInviteModal(false)}
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={sending}
                  >
                    {sending ? (
                      <>
                        <Loader2 size={18} className={styles.spinner} />
                        Sender...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send invitasjon
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
