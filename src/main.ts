import {
  defineComponent, html,
  ref, computed,
  onBeforeMount, onMounted, onBeforeUpdate, onUpdated, onUnmounted,
  update, provide, inject, Ref,
} from '.'

import { unsafeStatic } from 'lit-html/static.js'

import styles from './styles.css?inline'
import stylesModule from './styles.module.css'
console.log(styles)
console.log(stylesModule)

function useLifecycleCallbacks() {
  onBeforeMount(({ component }) => {
    console.log('custom-panel - before mounted', component)
  })

  onMounted(({ component }) => {
    console.log('custom-panel - mounted', component)
  })

  onBeforeUpdate(({ component }) => {
    console.log('custom-panel - onBeforeUpdate', component)
  })

  onUpdated(({ component }) => {
    console.log('custom-panel - onUpdated', component)
  })

  onUnmounted(({ component }) => {
    console.log('custom-panel - onUnmounted', component)
  })

  const message = ref('Hello, world!')

  return { message }
}

const injectionKey = Symbol('message')

// eslint-disable-next-line prefer-arrow-callback
defineComponent('custom-panel', { shadowRoot: false, styles }, { title: '1', age: 42 }, ({ component, props }) => {
  // eslint-disable-next-line no-invalid-this
  console.log('Initializing renderer', component)

  function clicked() {
    console.log('Clicked!')
    props.title = '123'
    props.age = 44
  }

  const { message } = useLifecycleCallbacks()

  const msg2 = computed({
    get() {
      return message.value
    },
    set(val: string) {
      message.value = val
    },
  })

  const msg3 = computed(() => `Header: ${msg2.value}`)

  provide(injectionKey, msg3)

  return () => {
    console.log('Rendering custom-panel')

    return html`
      <section>
        <div ${unsafeStatic(`test="Hello!"`)}></div>
        <h1 @click="${clicked}">${props.title}</h1>
        <input value="${msg2}" @input="${update(msg2)}">
        <div class="${stylesModule.test}">${message}</div>
        <slot></slot>
      </section>
    `
  }
})

defineComponent('example-consumer', {}, {}, () => {
  const message = inject(injectionKey)

  return () => html`<h1>${message}</h1>`
})

const counterSymbol = Symbol('counter')

defineComponent('counter-provider', {}, {}, ({ component }) => {
  component.provide(counterSymbol, ref(0))

  return () => html``
})

defineComponent('counter-display', {}, {}, ({ component }) => {
  const counter = component.inject<Ref<number>>(counterSymbol)

  function increment() {
    if (counter) counter.value++
  }

  return () => html`
    <div>
      <p>Current counter: ${counter}</p>
      <button type="button" @click="${increment}">Increment</button>
    </div>
  `
})
