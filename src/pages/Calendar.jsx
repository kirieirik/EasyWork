import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Briefcase,
  Clock,
  FileText,
  Truck,
  AlertCircle
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addDays,
  subDays,
  addWeeks, 
  subWeeks,
  addMonths,
  subMonths,
  isSameDay, 
  isToday, 
  parseISO,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  endOfWeek as getEndOfWeek
} from 'date-fns';
import { nb } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import styles from './Calendar.module.css';

// Calculate Easter using Anonymous Gregorian algorithm
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Get all Norwegian holidays for a year
function getNorwegianHolidays(year) {
  const easter = getEasterDate(year);
  
  const holidays = [
    // Fixed holidays
    { date: new Date(year, 0, 1), name: 'Nyttårsdag' },
    { date: new Date(year, 4, 1), name: '1. mai' },
    { date: new Date(year, 4, 17), name: '17. mai' },
    { date: new Date(year, 11, 25), name: '1. juledag' },
    { date: new Date(year, 11, 26), name: '2. juledag' },
    
    // Easter-based holidays
    { date: addDays(easter, -3), name: 'Skjærtorsdag' },
    { date: addDays(easter, -2), name: 'Langfredag' },
    { date: easter, name: '1. påskedag' },
    { date: addDays(easter, 1), name: '2. påskedag' },
    { date: addDays(easter, 39), name: 'Kristi himmelfartsdag' },
    { date: addDays(easter, 49), name: '1. pinsedag' },
    { date: addDays(easter, 50), name: '2. pinsedag' },
  ];
  
  return holidays;
}

// Check if a date is a holiday
function getHoliday(date, holidays) {
  return holidays.find(h => isSameDay(h.date, date));
}

// Event type configurations
const eventTypes = {
  job: {
    icon: Briefcase,
    label: 'Jobb',
    color: '#3b82f6',
    bgColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#3b82f6'
  },
  time_entry: {
    icon: Clock,
    label: 'Timer',
    color: '#10b981',
    bgColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#10b981'
  },
  quote: {
    icon: FileText,
    label: 'Tilbud',
    color: '#a855f7',
    bgColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#a855f7'
  },
  vehicle_service: {
    icon: Truck,
    label: 'Kjøretøy',
    color: '#f59e0b',
    bgColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#f59e0b'
  }
};

export default function Calendar() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState('week');
  
  // Get holidays for current and adjacent years
  const currentYear = currentDate.getFullYear();
  const holidays = [
    ...getNorwegianHolidays(currentYear - 1),
    ...getNorwegianHolidays(currentYear),
    ...getNorwegianHolidays(currentYear + 1)
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month view calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthViewStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthViewEnd = getEndOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthViewStart, end: monthViewEnd });

  useEffect(() => {
    if (organization?.id) {
      fetchEvents();
    } else {
      setLoading(false);
    }
  }, [organization, currentDate, viewMode]);

  const fetchEvents = async () => {
    setLoading(true);
    const allEvents = [];

    const rangeStart = viewMode === 'month' ? monthViewStart : weekStart;
    const rangeEnd = viewMode === 'month' ? monthViewEnd : weekEnd;

    try {
      // Fetch jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, start_date, customer:customers(name)')
        .eq('organization_id', organization.id)
        .not('start_date', 'is', null)
        .gte('start_date', format(rangeStart, 'yyyy-MM-dd'))
        .lte('start_date', format(rangeEnd, 'yyyy-MM-dd'));

      if (!jobsError && jobs) {
        jobs.forEach(job => {
          allEvents.push({
            id: job.id,
            type: 'job',
            title: job.title,
            subtitle: job.customer?.name ? `Kunde: ${job.customer.name}` : null,
            date: parseISO(job.start_date),
            link: `/jobber/${job.id}`
          });
        });
      }

      // Fetch time entries
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('id, date, hours, job:jobs(title)')
        .eq('organization_id', organization.id)
        .gte('date', format(rangeStart, 'yyyy-MM-dd'))
        .lte('date', format(rangeEnd, 'yyyy-MM-dd'));

      if (!timeError && timeEntries) {
        timeEntries.forEach(entry => {
          allEvents.push({
            id: entry.id,
            type: 'time_entry',
            title: `${entry.hours}t registrert`,
            subtitle: entry.job?.title ? `Jobb: ${entry.job.title}` : null,
            date: parseISO(entry.date),
            link: `/timer`
          });
        });
      }

      // Fetch quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id, title, valid_until, customer:customers(name)')
        .eq('organization_id', organization.id)
        .gte('valid_until', format(rangeStart, 'yyyy-MM-dd'))
        .lte('valid_until', format(rangeEnd, 'yyyy-MM-dd'));

      if (!quotesError && quotes) {
        quotes.forEach(quote => {
          allEvents.push({
            id: quote.id,
            type: 'quote',
            title: quote.title || 'Tilbud',
            subtitle: quote.customer?.name ? `Kunde: ${quote.customer.name}` : null,
            date: parseISO(quote.valid_until),
            link: `/tilbud/${quote.id}`
          });
        });
      }

      // Fetch vehicle services
      const { data: services, error: servicesError } = await supabase
        .from('vehicle_service_log')
        .select('id, service_type, service_date, vehicle:vehicles(name)')
        .gte('service_date', format(rangeStart, 'yyyy-MM-dd'))
        .lte('service_date', format(rangeEnd, 'yyyy-MM-dd'));

      if (!servicesError && services) {
        services.forEach(service => {
          allEvents.push({
            id: service.id,
            type: 'vehicle_service',
            title: service.service_type,
            subtitle: service.vehicle?.name ? `Kjøretøy: ${service.vehicle.name}` : null,
            date: parseISO(service.service_date),
            link: `/kjoretoy`
          });
        });
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setEvents(allEvents);
      setLoading(false);
    }
  };

  const getEventsForDay = (day) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const navigatePeriod = (direction) => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const navigateDay = (direction) => {
    const newDay = direction === 'prev' ? subDays(selectedDay, 1) : addDays(selectedDay, 1);
    setSelectedDay(newDay);
    if (viewMode === 'month') {
      if (!isSameMonth(newDay, currentDate)) {
        setCurrentDate(newDay);
      }
    } else {
      if (newDay < weekStart || newDay > weekEnd) {
        setCurrentDate(newDay);
      }
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const formatWeekRange = () => {
    const start = format(weekStart, 'd. MMM', { locale: nb });
    const end = format(weekEnd, 'd. MMM yyyy', { locale: nb });
    return `${start} - ${end}`;
  };

  // Month names for dropdown
  const monthNames = [
    'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Year options
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  const handleMonthSelect = (month) => {
    const newDate = new Date(currentDate.getFullYear(), month, 1);
    setCurrentDate(newDate);
  };

  const handleYearSelect = (year) => {
    const newDate = new Date(year, currentDate.getMonth(), 1);
    setCurrentDate(newDate);
  };

  // View toggle component
  const ViewToggle = ({ className = '' }) => (
    <div className={`${styles.viewToggle} ${className}`}>
      <button
        onClick={() => setViewMode('week')}
        className={`${styles.viewToggleBtn} ${viewMode === 'week' ? styles.viewToggleBtnActive : ''}`}
      >
        Ukentlig
      </button>
      <button
        onClick={() => setViewMode('month')}
        className={`${styles.viewToggleBtn} ${viewMode === 'month' ? styles.viewToggleBtnActive : ''}`}
      >
        Månedlig
      </button>
    </div>
  );

  // Month/Year selector component
  const MonthYearSelector = ({ className = '' }) => (
    <div className={`${styles.monthYearSelector} ${className}`}>
      <select
        value={currentDate.getMonth()}
        onChange={(e) => handleMonthSelect(parseInt(e.target.value))}
        className={styles.selectDropdown}
      >
        {monthNames.map((month, index) => (
          <option key={month} value={index}>{month}</option>
        ))}
      </select>
      <select
        value={currentDate.getFullYear()}
        onChange={(e) => handleYearSelect(parseInt(e.target.value))}
        className={styles.selectDropdown}
      >
        {yearOptions.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  // Helper to get gradient class for day card
  const getDayCardGradientClass = (day, holiday) => {
    if (holiday) return styles.gradientHoliday;
    if (isToday(day)) return styles.gradientToday;
    if (selectedDay && isSameDay(day, selectedDay)) return styles.gradientSelected;
    return styles.gradientDefault;
  };

  return (
    <div>
      {/* Header - Desktop */}
      {!isMobile && (
        <div className={styles.headerDesktop}>
          <div className={styles.headerNav}>
            <button 
              className="btn btn-ghost btn-icon"
              onClick={() => navigatePeriod('prev')}
              title={viewMode === 'month' ? 'Forrige måned' : 'Forrige uke'}
            >
              <ChevronLeft size={20} />
            </button>
            
            {viewMode === 'month' ? (
              <MonthYearSelector />
            ) : (
              <h2 className={styles.headerTitle}>
                {formatWeekRange()}
              </h2>
            )}
            
            <button 
              className="btn btn-ghost btn-icon"
              onClick={() => navigatePeriod('next')}
              title={viewMode === 'month' ? 'Neste måned' : 'Neste uke'}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className={styles.headerActions}>
            <ViewToggle />
            <button className="btn btn-secondary" onClick={goToToday}>
              <CalendarIcon size={16} />
              I dag
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/jobber/ny')}>
              <Plus size={16} />
              Ny jobb
            </button>
          </div>
        </div>
      )}

      {/* Header - Mobile */}
      {isMobile && (
        <div className={styles.headerMobile}>
          {/* Day Navigation */}
          <div className={styles.dayNavigation}>
            <button className="btn btn-ghost btn-icon" onClick={() => navigateDay('prev')}>
              <ChevronLeft size={24} />
            </button>
            
            <div className={styles.dayNavigationCenter}>
              <div className={styles.dayNavigationWeekday}>
                {format(selectedDay, 'EEEE', { locale: nb })}
              </div>
              <div className={`${styles.dayNavigationDate} ${isToday(selectedDay) ? styles.dayNavigationDateToday : ''}`}>
                {format(selectedDay, 'd. MMMM', { locale: nb })}
              </div>
            </div>
            
            <button className="btn btn-ghost btn-icon" onClick={() => navigateDay('next')}>
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Week mini overview */}
          <div className={styles.weekMiniOverview}>
            {weekDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDay);
              const isTodayDay = isToday(day);
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDay(day)}
                  className={`${styles.weekMiniDay} ${isSelected ? styles.weekMiniDaySelected : ''} ${!isSelected && isTodayDay ? styles.weekMiniDayToday : ''}`}
                >
                  <div className={`${styles.weekMiniDayName} ${isSelected ? styles.weekMiniDayNameSelected : ''}`}>
                    {format(day, 'EEE', { locale: nb })}
                  </div>
                  <div className={`${styles.weekMiniDayNumber} ${isSelected ? styles.weekMiniDayNumberSelected : ''} ${!isSelected && isTodayDay ? styles.weekMiniDayNumberToday : ''}`}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className={`${styles.weekMiniEventDot} ${isSelected ? styles.weekMiniEventDotSelected : ''}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className={styles.mobileActions}>
            <button className={`btn btn-secondary ${styles.mobileActionsBtn}`} onClick={goToToday}>
              <CalendarIcon size={16} />
              I dag
            </button>
            <button className={`btn btn-primary ${styles.mobileActionsBtn}`} onClick={() => navigate('/jobber/ny')}>
              <Plus size={16} />
              Ny jobb
            </button>
          </div>
          
          <ViewToggle className={styles.mobileActionsBtn} />
        </div>
      )}

      {/* Legend - Desktop only */}
      {!isMobile && (
        <div className={styles.legend}>
          {Object.entries(eventTypes).map(([key, type]) => (
            <div key={key} className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: type.color }} />
              {type.label}
            </div>
          ))}
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendDotHoliday}`} />
            Helligdag
          </div>
        </div>
      )}

      {/* Mobile: Single Day View */}
      {isMobile && viewMode === 'week' && (() => {
        const holiday = getHoliday(selectedDay, holidays);
        return (
          <div className={`${styles.dayCard} ${styles.dayCardMobile} ${holiday ? styles.gradientHoliday : isToday(selectedDay) ? styles.gradientToday : styles.gradientMobileDefault}`}>
            <div className={`${styles.dayCardInner} ${styles.dayCardMobileInner}`}>
              {/* Holiday banner */}
              {holiday && (
                <div className={styles.holidayBanner}>
                  <AlertCircle size={16} className={styles.holidayBadgeIcon} />
                  <span className={styles.holidayBannerText}>{holiday.name}</span>
                </div>
              )}
              
              {getEventsForDay(selectedDay).length === 0 ? (
                <div className={`${styles.emptyState} ${styles.emptyStateMobile}`}>
                  <CalendarIcon size={48} className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>Ingen hendelser denne dagen</p>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/jobber/ny')}>
                    <Plus size={14} />
                    Legg til jobb
                  </button>
                </div>
              ) : (
                <div className={`${styles.eventsContainer} ${styles.eventsContainerMobile}`}>
                  {getEventsForDay(selectedDay).map((event) => {
                    const config = eventTypes[event.type];
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={`${event.type}-${event.id}`}
                        onClick={() => navigate(event.link)}
                        className={`${styles.eventCard} ${styles.eventCardMobile}`}
                        style={{ 
                          backgroundColor: config.bgColor,
                          borderLeft: `4px solid ${config.color}`
                        }}
                      >
                        <div className={`${styles.eventCardHeader} ${styles.eventCardHeaderMobile}`}>
                          <Icon size={16} style={{ color: config.color }} />
                          <span className={`${styles.eventCardLabel} ${styles.eventCardLabelMobile}`} style={{ color: config.color }}>
                            {config.label}
                          </span>
                        </div>
                        <div className={`${styles.eventCardTitle} ${styles.eventCardTitleMobile}`}>
                          {event.title}
                        </div>
                        {event.subtitle && (
                          <div className={`${styles.eventCardSubtitle} ${styles.eventCardSubtitleMobile}`}>
                            {event.subtitle}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mobile: Month View */}
      {isMobile && viewMode === 'month' && (
        <div className={`card ${styles.monthCardMobile}`}>
          {/* Month header with selector */}
          <div className={styles.monthHeader}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft size={20} />
            </button>
            <MonthYearSelector />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigatePeriod('next')}>
              <ChevronRight size={20} />
            </button>
          </div>
          
          {/* Day headers */}
          <div className={`${styles.dayHeaders} ${styles.dayHeadersMobile}`}>
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(day => (
              <div key={day} className={`${styles.dayHeaderLabel} ${styles.dayHeaderLabelMobile}`}>
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className={`${styles.monthGrid} ${styles.monthGridMobile}`}>
            {monthDays.map((day, index) => {
              const holiday = getHoliday(day, holidays);
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDay = isToday(day);
              const isSelected = isSameDay(day, selectedDay);
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedDay(day);
                    setViewMode('week');
                    setCurrentDate(day);
                  }}
                  className={`${styles.monthDayButton} ${isSelected ? styles.monthDayButtonSelected : ''} ${!isSelected && holiday ? styles.monthDayButtonHoliday : ''} ${!isSelected && !holiday && isTodayDay ? styles.monthDayButtonToday : ''}`}
                  style={{ opacity: isCurrentMonth ? 1 : 0.3 }}
                >
                  <span className={`${styles.monthDayNumberMobile} ${isSelected ? styles.monthDayNumberSelected : ''} ${!isSelected && holiday ? styles.monthDayNumberHoliday : ''} ${!isSelected && !holiday && isTodayDay ? styles.monthDayNumberToday : ''}`}
                    style={{ fontWeight: isTodayDay || isSelected ? 700 : 400 }}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className={`${styles.monthEventDot} ${isSelected ? styles.monthEventDotSelected : ''}`} />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Legend for month view */}
          <div className={styles.monthLegend}>
            <div className={styles.monthLegendItem}>
              <div className={styles.monthLegendDot} style={{ backgroundColor: 'var(--accent-blue)' }} />
              Hendelse
            </div>
            <div className={styles.monthLegendItem}>
              <div className={`${styles.monthLegendDot} ${styles.monthLegendDotHoliday}`} />
              Helligdag
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Week Grid */}
      {!isMobile && viewMode === 'week' && (
        <div className={styles.weekGrid}>
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const holiday = getHoliday(day, holidays);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isTodayDay = isToday(day);
          
            return (
              <div
                key={index}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`${styles.dayCard} ${getDayCardGradientClass(day, holiday)}`}
              >
                <div className={styles.dayCardInner}>
                  {/* Day Header */}
                  <div className={styles.dayHeader}>
                    <div className={`${styles.dayHeaderWeekday} ${holiday ? styles.dayHeaderWeekdayHoliday : ''}`}>
                      {format(day, 'EEE', { locale: nb })}
                    </div>
                    <div className={`${styles.dayHeaderNumber} ${isTodayDay ? styles.dayHeaderNumberToday : ''} ${holiday ? styles.dayHeaderNumberHoliday : ''}`}>
                      {format(day, 'd')}
                    </div>
                    {/* Holiday label */}
                    {holiday && (
                      <div className={styles.holidayBadge}>
                        <AlertCircle size={10} className={styles.holidayBadgeIcon} />
                        <span className={styles.holidayBadgeText}>{holiday.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Events */}
                  <div className={styles.eventsContainer}>
                    {dayEvents.length === 0 ? (
                      <div className={styles.emptyState}>Ingen hendelser</div>
                    ) : (
                      dayEvents.map((event) => {
                        const config = eventTypes[event.type];
                        const Icon = config.icon;
                        
                        return (
                          <div
                            key={`${event.type}-${event.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(event.link);
                            }}
                            className={styles.eventCard}
                            style={{
                              backgroundColor: config.bgColor,
                              borderLeft: `3px solid ${config.color}`
                            }}
                          >
                            <div className={styles.eventCardHeader}>
                              <Icon size={12} style={{ color: config.color }} />
                              <span className={styles.eventCardLabel} style={{ color: config.color }}>
                                {config.label}
                              </span>
                            </div>
                            <div className={styles.eventCardTitle}>{event.title}</div>
                            {event.subtitle && (
                              <div className={styles.eventCardSubtitle}>{event.subtitle}</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop: Month Grid */}
      {!isMobile && viewMode === 'month' && (
        <div className={`card ${styles.monthCard}`}>
          {/* Day headers */}
          <div className={styles.dayHeaders}>
            {['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'].map(day => (
              <div key={day} className={styles.dayHeaderLabel}>{day}</div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className={styles.monthGrid}>
            {monthDays.map((day, index) => {
              const holiday = getHoliday(day, holidays);
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDay = isToday(day);
              const isSelected = isSameDay(day, selectedDay);
              
              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDay(day);
                    setViewMode('week');
                    setCurrentDate(day);
                  }}
                  className={`${styles.monthDayCell} ${isSelected ? styles.monthDayCellSelected : ''} ${holiday ? styles.monthDayCellHoliday : ''} ${isTodayDay ? styles.monthDayCellToday : ''} ${!isCurrentMonth ? styles.monthDayCellOtherMonth : ''}`}
                >
                  <div className={styles.monthDayHeader}>
                    <span className={`${styles.monthDayNumber} ${isTodayDay ? styles.monthDayNumberToday : ''} ${holiday ? styles.monthDayNumberHoliday : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {holiday && (
                      <span className={styles.monthDayHolidayTag}>{holiday.name}</span>
                    )}
                  </div>
                  
                  {/* Event dots/preview */}
                  <div className={styles.monthEventPreview}>
                    {dayEvents.slice(0, 3).map((event, i) => {
                      const config = eventTypes[event.type];
                      return (
                        <div
                          key={i}
                          className={styles.monthEventItem}
                          style={{
                            backgroundColor: config.bgColor,
                            borderLeft: `2px solid ${config.color}`
                          }}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className={styles.monthEventMore}>+{dayEvents.length - 3} mer</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State Info - Desktop only */}
      {!isMobile && events.length === 0 && viewMode === 'week' && (
        <div className={styles.globalEmptyState}>
          <CalendarIcon size={48} className={styles.globalEmptyStateIcon} />
          <h3 className={styles.globalEmptyStateTitle}>Ingen hendelser denne uken</h3>
          <p className={styles.globalEmptyStateText}>
            Kalenderen fylles automatisk når du oppretter jobber, registrerer timer, 
            eller legger til andre aktiviteter.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/jobber/ny')}>
            <Plus size={16} />
            Opprett din første jobb
          </button>
        </div>
      )}
    </div>
  );
}
