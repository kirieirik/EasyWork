import { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import styles from './DateInput.module.css';

/**
 * DateInput - A user-friendly date input with Norwegian format (DD.MM.YYYY)
 * Supports typing with auto-formatting and a native date picker fallback
 */
export default function DateInput({ 
  id, 
  name, 
  value, 
  onChange, 
  placeholder = 'DD.MM.ÅÅÅÅ',
  className = '',
  required = false
}) {
  // Convert YYYY-MM-DD to DD.MM.YYYY for display
  const formatForDisplay = (isoDate) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  };

  // Convert DD.MM.YYYY to YYYY-MM-DD for storage
  const formatForStorage = (displayDate) => {
    if (!displayDate) return '';
    const cleaned = displayDate.replace(/[^\d]/g, '');
    if (cleaned.length !== 8) return '';
    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);
    
    // Validate
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
      return '';
    }
    
    return `${year}-${month}-${day}`;
  };

  const [displayValue, setDisplayValue] = useState(formatForDisplay(value));
  const hiddenInputRef = useRef(null);

  // Update display when value prop changes
  useEffect(() => {
    setDisplayValue(formatForDisplay(value));
  }, [value]);

  const handleInputChange = (e) => {
    let input = e.target.value;
    
    // Remove all non-digits
    const digits = input.replace(/[^\d]/g, '');
    
    // Format with dots as user types
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 2);
    }
    if (digits.length > 2) {
      formatted += '.' + digits.substring(2, 4);
    }
    if (digits.length > 4) {
      formatted += '.' + digits.substring(4, 8);
    }
    
    setDisplayValue(formatted);
    
    // If we have a complete date, convert and call onChange
    if (digits.length === 8) {
      const isoDate = formatForStorage(formatted);
      if (isoDate) {
        onChange({ target: { name, value: isoDate } });
      }
    } else if (digits.length === 0) {
      // Clear the value
      onChange({ target: { name, value: '' } });
    }
  };

  const handleBlur = () => {
    // On blur, validate and format
    const digits = displayValue.replace(/[^\d]/g, '');
    if (digits.length === 8) {
      const isoDate = formatForStorage(displayValue);
      if (isoDate) {
        setDisplayValue(formatForDisplay(isoDate));
        onChange({ target: { name, value: isoDate } });
      } else {
        // Invalid date, clear it
        setDisplayValue('');
        onChange({ target: { name, value: '' } });
      }
    } else if (digits.length > 0) {
      // Incomplete date, clear it
      setDisplayValue('');
      onChange({ target: { name, value: '' } });
    }
  };

  const handleCalendarClick = () => {
    hiddenInputRef.current?.showPicker();
  };

  const handleNativeDateChange = (e) => {
    const isoDate = e.target.value;
    setDisplayValue(formatForDisplay(isoDate));
    onChange({ target: { name, value: isoDate } });
  };

  return (
    <div className={styles.dateInputWrapper}>
      <input
        type="text"
        id={id}
        className={`form-input ${className} ${styles.dateInput}`}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        inputMode="numeric"
        required={required}
      />
      <button 
        type="button" 
        className={styles.calendarButton}
        onClick={handleCalendarClick}
        tabIndex={-1}
      >
        <Calendar size={18} />
      </button>
      <input
        ref={hiddenInputRef}
        type="date"
        className={styles.hiddenDateInput}
        value={value || ''}
        onChange={handleNativeDateChange}
        tabIndex={-1}
      />
    </div>
  );
}
