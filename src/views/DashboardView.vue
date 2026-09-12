<script setup lang="ts">
import CardContainer from '../components/CardContainer.vue'
import DataTable from '../components/DataTable.vue'
</script>

<template>
  <div class="dashboard-header">
    <h1>Dashboard</h1>
  </div>

  <main class="dashboard">
    <div class="card">
      <h2>RESUMO DO DIA</h2>
      <div class="card-content">
        <CardContainer />
        <CardContainer />
        <CardContainer />
        <CardContainer />
      </div>
    </div>

    <div class="card card-filters">
      <h2>FILTROS AVANÇADOS</h2>
      <div class="card-content filters-container">
        <div class="filter-item">
          <span class="icon"></span>
          <label for="dateBeggin">Início:</label>
          <input type="date" id="dateBeggin" name="date" class="input-inline" />
        </div>

        <div class="filter-item">
          <span class="icon"></span>
          <label for="dateEnd">Fim:</label>
          <input type="date" id="dateEnd" name="date" class="input-inline" />
        </div>

        <div class="filter-item">
          <span class="icon"></span>
          <label>Conjunto:</label>
          <select class="input-inline">
            <option value="">Selecionar</option>
          </select>
        </div>

        <div class="filter-item">
          <span class="icon"></span>
          <label>Etapa:</label>
          <select class="input-inline">
            <option value="">Selecionar</option>
          </select>
        </div>

        <div class="filter-item">
          <span class="icon"></span>
          <label>Situação:</label>
          <select class="input-inline">
            <option value="">Selecionar</option>
          </select>
        </div>

        <div class="filter-actions">
          <button class="btn btn-search">Buscar</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>PROCESSOS RECENTES</h2>
      <div class="card-content">
        <DataTable />
      </div>
    </div>
  </main>
</template>

<style scoped>
.dashboard-header {
  padding: 2rem 2rem 0;
}

.dashboard-header h1 {
  margin: 0;
  color: var(--color-heading);
}

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
}

.card {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.card h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--color-heading);
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
}

.card-content {
  display: flex;
  flex-direction: row;
  padding: 1rem;
  background-color: var(--color-background-soft);
  width: 100%;
}

.filters-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.filter-item {
  display: flex;
  align-items: center;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.filter-item .icon {
  font-size: 1rem;
  opacity: 0.8;
}

.filter-item label {
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-heading);
}

.input-inline {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.85rem;
  color: var(--color-text);
  padding: 0;
  margin: 0;
  cursor: pointer;
}

.input-inline:focus {
  outline: none;
}

.filter-actions {
  display: flex;
  align-items: center;
}

.btn-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--vis-c-dark-mute, #334155);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.btn-search:hover {
  background-color: var(--vis-c-dark, #0f172a);
}
</style>
