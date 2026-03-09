-- Modelagem do Banco de Dados para Neon DB (PostgreSQL)
-- Este script cria as tabelas necessárias para o sistema de controle de ponto.

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'employee', -- 'employee', 'admin'
    work_schedule_minutes INTEGER DEFAULT 440, -- 07:20:00 = 440 minutos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Feriados (Cache das APIs BrasilAPI/FeriadosAPI)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'national', 'state', 'municipal'
    location VARCHAR(100) -- 'BR', 'SP', 'Bauru'
);

-- Tabela de Marcações de Ponto
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    entry_1 TIME,
    exit_1 TIME,
    entry_2 TIME,
    exit_2 TIME,
    is_manual BOOLEAN DEFAULT FALSE,
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Tabela de Fechamento Diário (Resultados dos Cálculos)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_worked_minutes INTEGER DEFAULT 0,
    night_minutes_ficta INTEGER DEFAULT 0, -- Minutos noturnos já com o fator 1.1428
    overtime_normal_minutes INTEGER DEFAULT 0,
    overtime_100_minutes INTEGER DEFAULT 0,
    balance_minutes INTEGER DEFAULT 0, -- Saldo do dia (positivo ou negativo)
    is_holiday BOOLEAN DEFAULT FALSE,
    is_weekend BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, date)
);

-- Índices para performance
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_daily_summaries_user_date ON daily_summaries(user_id, date);
CREATE INDEX idx_holidays_date ON holidays(date);
