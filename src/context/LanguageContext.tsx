import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Menu Admin & Geral
    adminPanel: "Admin Panel",
    adminSubtitle: "User, company, and payment management",
    executiveSummary: "Executive Summary",
    finance: "Finance",
    users: "Users",
    influencers: "Influencers",
    teamManagement: "Team Management",
    systemApi: "System & APIs",
    aiLab: "AI Lab",
    marketBids: "Market & Bids",
    nexusHub: "Nexus Hub",
    quickJump: "Admin Quick Jump",
    updateAll: "Update All",
    
    // Abas do Admin
    overview: "Overview",
    waitingList: "Waiting List",
    companies: "Companies",
    payments: "Payments",
    alerts: "Alerts",
    crm: "CRM",
    mural: "Mural",
    contacts: "Contacts",
    communications: "Communications",

    // Cards e Métricas
    totalRevenue: "Total Revenue",
    activeUsers: "Active Users",
    soldBlocks: "Sold Blocks",
    pendingUsers: "Pending users",
    expiringCompanies: "Expiring companies",
    revenueByRegion: "Revenue by Region",
    blockStatus: "Block Status",
    noBlocksRegistered: "No blocks registered"
  },
  pt: {
    // Menu Admin & Geral
    adminPanel: "Painel Administrativo",
    adminSubtitle: "Gestão de usuários, empresas e pagamentos",
    executiveSummary: "Sumário Executivo",
    finance: "Finanças",
    users: "Usuários",
    influencers: "Influenciadores",
    teamManagement: "Gestão de Equipe",
    systemApi: "Sistema & APIs",
    aiLab: "AI Lab",
    marketBids: "Mercado & Bids",
    nexusHub: "Nexus Hub",
    quickJump: "Admin Quick Jump",
    updateAll: "Atualizar tudo",
    
    // Abas do Admin
    overview: "Visão Geral",
    waitingList: "Lista de Espera",
    companies: "Empresas",
    payments: "Pagamentos",
    alerts: "Alertas",
    crm: "CRM",
    mural: "Mural",
    contacts: "Contatos",
    communications: "Comunicações",

    // Cards e Métricas
    totalRevenue: "Receita Total",
    activeUsers: "Usuários Ativos",
    soldBlocks: "Blocos Vendidos",
    pendingUsers: "pendentes",
    expiringCompanies: "expirando",
    revenueByRegion: "Receita por Região",
    blockStatus: "Status dos Blocos",
    noBlocksRegistered: "Nenhum bloco registrado"
  },
  es: {
    // Menu Admin & Geral
    adminPanel: "Panel Administrativo",
    adminSubtitle: "Gestión de usuarios, empresas y pagos",
    executiveSummary: "Resumen Ejecutivo",
    finance: "Finanzas",
    users: "Usuarios",
    influencers: "Influencers",
    teamManagement: "Gestión de Equipo",
    systemApi: "Sistema y APIs",
    aiLab: "Laboratorio IA",
    marketBids: "Mercado y Bids",
    nexusHub: "Nexus Hub",
    quickJump: "Salto Rápido Admin",
    updateAll: "Actualizar todo",
    
    // Abas do Admin
    overview: "Vista General",
    waitingList: "Lista de Espera",
    companies: "Empresas",
    payments: "Pagamentos",
    alerts: "Alertas",
    crm: "CRM",
    mural: "Mural",
    contacts: "Contactos",
    communications: "Comunicaciones",

    // Cards e Métricas
    totalRevenue: "Ingresos Totales",
    activeUsers: "Usuarios Activos",
    soldBlocks: "Bloques Vendidos",
    pendingUsers: "pendientes",
    expiringCompanies: "expirando",
    revenueByRegion: "Ingresos por Región",
    blockStatus: "Estado de Bloques",
    noBlocksRegistered: "Ningún bloque registrado"
  }
};

const LanguageContext = createContext({
  language: 'en',
  setLanguage: (lang: string) => {},
  t: (key: string) => key
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState('en'); // Inglês como padrão absoluto

  const t = (key: string) => {
    return translations[language]?.[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);