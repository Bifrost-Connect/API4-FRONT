<script setup lang="ts">
import { computed } from 'vue'
import { FiCheck } from 'vue-icons-plus/fi'

const props = defineProps<{
  currentStep: number
  steps: string[]
}>()

const progressPercentage = computed(() => {
  if (props.steps.length <= 1) return '0%'
  return `${((props.currentStep - 1) / (props.steps.length - 1)) * 100}%`
})
</script>

<template>
  <div class="stepper">
    <div
      v-for="(step, index) in steps"
      :key="index"
      class="step"
      :class="{
        'step--active': currentStep === index + 1,
        'step--completed': currentStep > index + 1,
      }"
    >
      <div class="step__indicator">
        <FiCheck v-if="currentStep > index + 1" size="16" />
        <span v-else>{{ index + 1 }}</span>
      </div>
      <span class="step__label">
        {{ step }}
      </span>
    </div>
    <div class="stepper__line" :style="{ '--progress': progressPercentage }"></div>
  </div>
</template>

<style scoped>
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
  top: 1.25rem;
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
</style>
