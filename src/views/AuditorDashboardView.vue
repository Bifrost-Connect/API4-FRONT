<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { FiArrowUpRight, FiCheckCircle, FiClock, FiShield } from 'vue-icons-plus/fi'
import { dashboardService, type ProcessLog } from '../services/dashboard'

const router = useRouter()
const processes = ref<ProcessLog[]>([])
const isLoading = ref(true)
const loadError = ref(false)

const reviewQueue = computed(() =>
  processes.value.filter((process) => {
    const status = process.status.toLowerCase()
    const stage = process.stage.toLowerCase()
    return (
      status.includes('valida') ||
      status.includes('quarentena') ||
      status.includes('falh') ||
      (status.includes('andamento') && stage.includes('publica'))
    )
  }),
)

const waitingCount = computed(
  () => reviewQueue.value.filter((process) => process.status.toLowerCase().includes('valida')).length,
)
const quarantineCount = computed(
  () =>
    reviewQueue.value.filter((process) => {
      const status = process.status.toLowerCase()
      return status.includes('quarentena') || status.includes('falh')
    }).length,
)
const completedCount = computed(
  () => processes.value.filter((process) => process.status.toLowerCase().includes('conclu')).length,
)

const openProcess = (id: string) => router.push({ name: 'process-log', params: { id } })

const statusClass = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized.includes('conclu')) return 'status-complete'
  if (normalized.includes('quarentena') || normalized.includes('falh')) return 'status-alert'
  return 'status-pending'
}

onMounted(async () => {
  try {
    const page = await dashboardService.getDashboardProcesses()
    processes.value = page.content
  } catch (error) {
    console.error('Não foi possível carregar a fila do auditor:', error)
    loadError.value = true
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="auditor-dashboard">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Área de trabalho</p>
        <h1>Painel do auditor</h1>
        <p class="page-description">
          Revise cargas pendentes, confira inconsistências e acompanhe os registros auditados.
        </p>
      </div>
      <RouterLink to="/auditoria" class="history-link">
        Histórico de auditoria <FiArrowUpRight size="17" />
      </RouterLink>
    </header>

    <section class="summary-grid" aria-label="Resumo da auditoria">
      <article class="summary-card summary-card-pending">
        <span class="summary-icon"><FiClock size="20" /></span>
        <div><span>Na fila de revisão</span><strong>{{ waitingCount }}</strong></div>
      </article>
      <article class="summary-card summary-card-alert">
        <span class="summary-icon"><FiShield size="20" /></span>
        <div><span>Com inconsistências</span><strong>{{ quarantineCount }}</strong></div>
      </article>
      <article class="summary-card summary-card-complete">
        <span class="summary-icon"><FiCheckCircle size="20" /></span>
        <div><span>Cargas concluídas</span><strong>{{ completedCount }}</strong></div>
      </article>
    </section>

    <section class="queue-panel">
      <div class="queue-heading">
        <div>
          <h2>Cargas que precisam de atenção</h2>
          <p>Abra uma carga para consultar as etapas, os logs e as versões disponíveis.</p>
        </div>
        <span class="queue-count">{{ reviewQueue.length }} itens</span>
      </div>

      <div v-if="isLoading" class="queue-state" role="status">Carregando a fila de revisão…</div>
      <div v-else-if="loadError" class="queue-state queue-error" role="alert">
        Não foi possível carregar as cargas. Tente novamente mais tarde.
      </div>
      <div v-else-if="reviewQueue.length === 0" class="queue-state">
        Não há cargas aguardando revisão no momento.
      </div>

      <div v-else class="review-list">
        <article v-for="process in reviewQueue" :key="process.id" class="review-item">
          <div class="review-main">
            <div class="review-title-row">
              <strong>{{ process.dataset }}</strong>
              <span class="status-pill" :class="statusClass(process.status)">{{ process.status }}</span>
            </div>
            <span class="review-id">Carga {{ process.id }} · {{ process.dateTime }}</span>
            <span class="review-stage">Etapa: {{ process.stage }}<template v-if="process.source"> · Origem: {{ process.source }}</template></span>
            <p v-if="process.pauseReason" class="review-reason">{{ process.pauseReason }}</p>
          </div>
          <button class="review-action" type="button" @click="openProcess(process.id)">
            Revisar carga <FiArrowUpRight size="16" />
          </button>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auditor-dashboard { max-width: 1240px; margin: 0 auto; color: var(--color-text); }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 28px; }
.eyebrow { margin: 0 0 6px; color: var(--vis-brand-orange); font-size: .74rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; color: var(--color-heading); font-size: 1.8rem; }
.page-description { margin: 8px 0 0; color: var(--vis-c-text-dark-2); }
.history-link { display: inline-flex; align-items: center; gap: 6px; color: var(--vis-brand-primary); font-size: .9rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
.history-link:hover { text-decoration: underline; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.summary-card { display: flex; align-items: center; gap: 14px; min-height: 108px; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-top: 3px solid var(--vis-brand-orange); border-radius: 8px; }
.summary-card-pending { border-top-color: var(--vis-c-info); }
.summary-card-alert { border-top-color: var(--vis-c-warning); }
.summary-card-complete { border-top-color: var(--vis-c-success); }
.summary-icon { display: grid; width: 42px; height: 42px; place-items: center; color: var(--vis-brand-orange); background: var(--color-surface-soft); border-radius: 50%; }
.summary-card-pending .summary-icon { color: var(--vis-c-info); }
.summary-card-alert .summary-icon { color: var(--vis-c-warning); }
.summary-card-complete .summary-icon { color: var(--vis-c-success); }
.summary-card div { display: grid; gap: 3px; }
.summary-card div span { color: var(--vis-c-text-dark-2); font-size: .82rem; }
.summary-card strong { color: var(--color-heading); font-size: 1.55rem; }
.queue-panel { overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; }
.queue-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid var(--color-border); }
.queue-heading h2 { margin: 0; color: var(--color-heading); font-size: 1.08rem; }
.queue-heading p { margin: 5px 0 0; color: var(--vis-c-text-dark-2); font-size: .85rem; }
.queue-count { flex-shrink: 0; padding: 5px 10px; color: var(--vis-brand-primary); background: var(--color-surface-soft); border-radius: 999px; font-size: .78rem; font-weight: 700; }
.queue-state { padding: 36px 20px; color: var(--vis-c-text-dark-2); text-align: center; }
.queue-error { color: var(--vis-c-danger); }
.review-list { display: grid; }
.review-item { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 22px; border-bottom: 1px solid var(--color-border); }
.review-item:last-child { border-bottom: 0; }
.review-main { display: grid; gap: 5px; min-width: 0; }
.review-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.review-title-row strong { color: var(--color-heading); }
.review-id, .review-stage { color: var(--vis-c-text-dark-2); font-size: .8rem; }
.review-reason { margin: 3px 0 0; color: var(--color-text); font-size: .84rem; }
.status-pill { padding: 3px 8px; border-radius: 999px; font-size: .7rem; font-weight: 700; }
.status-pending { color: #075985; background: #e0f2fe; }
.status-alert { color: #b45309; background: #fef3c7; }
.status-complete { color: #166534; background: #dcfce7; }
.review-action { display: inline-flex; flex-shrink: 0; align-items: center; gap: 7px; padding: 9px 12px; color: white; background: var(--vis-brand-primary); border: 0; border-radius: 6px; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
.review-action:hover { filter: brightness(.94); }
@media (max-width: 760px) {
  .page-heading { align-items: flex-start; flex-direction: column; }
  .summary-grid { grid-template-columns: 1fr; }
  .review-item { align-items: flex-start; flex-direction: column; }
  .review-action { width: 100%; justify-content: center; }
}
</style>
