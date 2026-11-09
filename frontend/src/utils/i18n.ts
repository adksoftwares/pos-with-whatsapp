// Foundation for future i18n support
export type Language = 'en' | 'ta' | 'si';

type Dictionary = {
  [key in Language]?: Record<string, string>;
};

// Placeholder dictionary architecture
const dictionary: Dictionary = {
  en: {
    dashboard: 'Dashboard',
    newBill: 'New Bill',
    sales: 'Sales',
    products: 'Products',
    customers: 'Customers',
    settings: 'Settings',
    reports: 'Reports',
    searchPlaceholder: 'Search...',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    pay: 'Pay',
    cancel: 'Cancel',
    save: 'Save',
  }
};

export const t = (key: keyof typeof dictionary.en, lang: Language = 'en'): string => {
  const translations = dictionary[lang];
  return (translations && translations[key]) || dictionary.en?.[key] || key;
};
