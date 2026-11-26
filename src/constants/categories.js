export const EXPENSE_CATEGORIES = [
  { key: 'Food', icon: 'restaurant', color: '#E8833A' },
  { key: 'Transport', icon: 'car', color: '#2F8FC7' },
  { key: 'Rent', icon: 'home', color: '#7C5CC4' },
  { key: 'Bills', icon: 'flash', color: '#C9A227' },
  { key: 'Shopping', icon: 'bag-handle', color: '#CF4C86' },
  { key: 'Health', icon: 'medkit', color: '#D8483F' },
  { key: 'Entertainment', icon: 'film', color: '#1AA39A' },
  { key: 'Education', icon: 'school', color: '#4F5BD5' },
  { key: 'Other', icon: 'ellipsis-horizontal-circle', color: '#64748B' },
];

export const INCOME_CATEGORIES = [
  { key: 'Salary', icon: 'cash', color: '#1B8A5A' },
  { key: 'Business', icon: 'briefcase', color: '#0F8B8D' },
  { key: 'Gift', icon: 'gift', color: '#CF4C86' },
  { key: 'Other', icon: 'add-circle', color: '#64748B' },
];

export const categoriesFor = (type) => (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
export const catMeta = (type, key) =>
  categoriesFor(type).find((c) => c.key === key) || { key, icon: 'pricetag', color: '#64748B' };
