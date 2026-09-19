<script setup lang="ts">
import { ref } from 'vue'
import { FiUploadCloud, FiCheck, FiInfo } from 'vue-icons-plus/fi'

// Steps
const currentStep = ref(1)

const nextStep = () => {
  if (currentStep.value < 3) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}
</script>

<template>
  <main class="upload-view">
    <!-- Page Header -->
    <div class="upload-header">
      <h1>Nova Carga de Dados</h1>
      <p class="upload-subtitle">Envie arquivos geoespaciais para ingestão na Zona Bruta do sistema.</p>
    </div>

    <!-- Stepper -->
    <div class="stepper">
      <div
        v-for="step in 3"
        :key="step"
        class="step"
        :class="{
          'step--active': currentStep === step,
          'step--completed': currentStep > step,
        }"
      >
        <div class="step__indicator">
          <FiCheck v-if="currentStep > step" size="16" />
          <span v-else>{{ step }}</span>
        </div>
        <span class="step__label">
          {{ step === 1 ? 'Origem dos Dados' : step === 2 ? 'Upload do Arquivo' : 'Confirmação' }}
        </span>
      </div>
      <div class="stepper__line" :style="{ '--progress': `${((currentStep - 1) / 2) * 100}%` }"></div>
    </div>

    <!-- Step 1: Metadata -->
    <div v-show="currentStep === 1" class="upload-card step-card animate-in">
      <div class="card-header">
        <FiInfo size="20" class="card-header-icon" />
        <h2>Dados de Origem</h2>
      </div>
      <p class="card-description">
        Cadastre a procedência do arquivo: órgão emissor, ano de referência e sistema de coordenadas.
      </p>

      <div class="form-grid">
        <div class="form-group">
          <label class="label" for="upload-orgao">Órgão Emissor *</label>
          <input
            id="upload-orgao"
            type="text"
            class="input"
            placeholder="Ex: IBGE, INCRA, MapBiomas..."
          />
        </div>

        <div class="form-group">
          <label class="label" for="upload-ano">Ano de Referência *</label>
          <select id="upload-ano" class="input">
            <option value="">Selecione o ano</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
          </select>
        </div>

        <div class="form-group">
          <label class="label" for="upload-epsg">Sistema de Coordenadas (EPSG) *</label>
          <select id="upload-epsg" class="input">
            <option value="">Selecione o EPSG</option>
            <option value="4326">EPSG:4326</option>
            <option value="3857">EPSG:3857</option>
          </select>
        </div>

        <div class="form-group">
          <label class="label" for="upload-conjunto">Conjunto de Dados *</label>
          <select id="upload-conjunto" class="input">
            <option value="">Selecione o conjunto</option>
            <option value="1">Conjunto 1</option>
            <option value="2">Conjunto 2</option>
          </select>
        </div>

        <div class="form-group form-group--full">
          <label class="label" for="upload-descricao">Descrição (opcional)</label>
          <textarea
            id="upload-descricao"
            class="input textarea"
            rows="3"
            placeholder="Observações sobre o arquivo ou a base de dados..."
          ></textarea>
        </div>
      </div>

      <div class="step-actions">
        <span></span>
        <button class="btn" @click="nextStep">
          Avançar
        </button>
      </div>
    </div>

    <!-- Step 2: File Upload -->
    <div v-show="currentStep === 2" class="upload-card step-card animate-in">
      <div class="card-header">
        <FiUploadCloud size="20" class="card-header-icon" />
        <h2>Upload do Arquivo</h2>
      </div>
      <p class="card-description">
        Arraste ou selecione o arquivo geoespacial. Uma cópia original será salva na Zona Bruta com hash SHA-256 de integridade.
      </p>

      <!-- Drop Zone -->
      <div class="dropzone">
        <div class="dropzone__content">
          <div class="dropzone__icon-wrapper">
            <FiUploadCloud size="48" class="dropzone__icon" />
          </div>
          <p class="dropzone__title">Arraste o arquivo aqui</p>
          <p class="dropzone__subtitle">ou clique para selecionar</p>
          <div class="dropzone__formats">
            <span class="format-tag" v-for="ext in ['.shp', '.geojson', '.gpkg', '.kml', '.zip', '.csv', '.tif']" :key="ext">
              {{ ext }}
            </span>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button class="btn btn_outline" @click="prevStep">Recuar</button>
        <button class="btn" @click="nextStep">
          Avançar
        </button>
      </div>
    </div>

    <!-- Step 3: Confirmation -->
    <div v-show="currentStep === 3" class="upload-card step-card animate-in">
      <div class="confirmation">
        <div class="confirmation__icon-wrapper">
          <FiCheck size="40" class="confirmation__icon" />
        </div>
        <h2 class="confirmation__title">Carga Registrada com Sucesso!</h2>
        <p class="confirmation__subtitle">O arquivo foi recebido e está sendo processado na Zona Bruta.</p>

        <div class="confirmation__actions">
          <button class="btn" @click="currentStep = 1">+ Nova Carga</button>
          <router-link to="/" class="btn btn_outline">Voltar ao Dashboard</router-link>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.upload-view {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.upload-header {
  margin-bottom: 2rem;
}

.upload-header h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-heading);
  margin: 0 0 0.5rem 0;
}

.upload-subtitle {
  color: var(--color-text);
  opacity: 0.7;
  font-size: 1rem;
  margin: 0;
}

/* Stepper */
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  position: relative;
  padding: 0 1rem;
}

.stepper__line {
  position: absolute;
  top: 1.25rem; /* Fix: explicitly half the indicator height instead of 50% */
  left: 3rem;
  right: 3rem;
  height: 3px;
  background-color: var(--color-border);
  transform: translateY(-50%);
  z-index: 0;
  border-radius: 2px;
}

.stepper__line::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--progress);
  background-color: var(--vis-brand-orange);
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  z-index: 1;
  cursor: default;
}

.step__indicator {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  border: 3px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: all 0.3s ease;
}

.step--active .step__indicator {
  border-color: var(--vis-brand-orange);
  background-color: var(--vis-brand-orange);
  color: #ffffff;
  box-shadow: 0 0 0 4px rgba(242, 101, 34, 0.2);
}

.step--completed .step__indicator {
  border-color: var(--vis-c-success);
  background-color: var(--vis-c-success);
  color: #ffffff;
}

.step__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
  opacity: 0.5;
  text-align: center;
  transition: opacity 0.3s ease;
}

.step--active .step__label {
  opacity: 1;
  color: var(--vis-brand-orange);
}

.step--completed .step__label {
  opacity: 0.8;
  color: var(--vis-c-success);
}

/* Card */
.upload-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading);
  margin: 0;
}

.card-header-icon {
  color: var(--vis-brand-orange);
}

.card-description {
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-group .label {
  margin-bottom: 0.4rem;
}

.textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

/* Dropzone */
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 12px;
  padding: 3rem 2rem;
  background-color: var(--color-surface-soft, var(--vis-c-light-soft));
  text-align: center;
}

.dropzone__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.dropzone__icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(242, 101, 34, 0.1), rgba(242, 101, 34, 0.05));
  margin-bottom: 0.5rem;
}

.dropzone__icon {
  color: var(--vis-brand-orange);
  opacity: 0.8;
}

.dropzone__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-heading);
  margin: 0;
}

.dropzone__subtitle {
  font-size: 0.9rem;
  color: var(--color-text);
  opacity: 0.6;
  margin: 0;
}

.dropzone__formats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.format-tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: monospace;
  background-color: rgba(242, 101, 34, 0.08);
  color: var(--vis-brand-orange);
  letter-spacing: 0.03em;
}

/* Step Actions */
.step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

/* Confirmation */
.confirmation {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.confirmation__icon-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.confirmation__icon {
  color: var(--vis-c-success);
}

.confirmation__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-heading);
  margin: 0 0 0.5rem 0;
}

.confirmation__subtitle {
  color: var(--color-text);
  opacity: 0.7;
  margin: 0 0 2rem 0;
  font-size: 1rem;
}

.confirmation__actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* Animation */
.animate-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .stepper {
    padding: 0;
  }

  .step__label {
    font-size: 0.65rem;
  }

  .confirmation__actions {
    flex-direction: column;
    width: 100%;
  }

  .confirmation__actions .btn {
    width: 100%;
  }
}
</style>
