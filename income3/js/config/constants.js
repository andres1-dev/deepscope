/**
 * Constants and Configuration
 */

const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';

const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    REC2024: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY",
    BUDGETID: "10P1BtnwjUrSuM4ZajAdUiHXNEzpi4H2zsJvQVYp5jtQ"
};

// Global State
let consolidatedData = [];
let globalConsolidatedData = [];
let budgetData = [];
let currentReportData = null;
let isLoading = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Trends and Charts
let tendenciaChart = null;
let globalTrend = null;
let tendenciaValues = [];

// DataBase Modal State
let datosRegistros = null;
let datosCargando = false;

// Provider filter
let selectedProveedor = 'todos';
let allIncomeData = []; // Stores raw income data before consolidation
