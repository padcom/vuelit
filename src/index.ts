import { TemplateResult, render } from 'lit-html'
import { shallowReactive, effect, isRef, type MaybeRef } from '@vue/reactivity'

type LifecycleMethod = 'onBeforeMount' | 'onMounted' | 'onBeforeUpdate' | 'onUpdated' | 'onUnmounted'

interface LifecycleCallbackParams {
  // eslint-disable-next-line no-use-before-define
  component: VuelitComponent
}

// eslint-disable-next-line no-use-before-define
type LifecycleCallback = (context: LifecycleCallbackParams) => void

/**
 * Definition of Vuelit component
 */
export interface VuelitComponent extends HTMLElement {
  /**
   * Register a callback for component lifecycle
   */
  registerLifecycleCallback: (method: LifecycleMethod, callback: LifecycleCallback) => void
}

type RenderFunction = () => TemplateResult

interface FactoryFunctionParams<Props> {
  component: VuelitComponent
  props: Props
}

type FactoryFunction<Props> = (this: VuelitComponent, context: FactoryFunctionParams<Props>) => RenderFunction

let currentInstance: VuelitComponent | null

interface Options {
  shadowRoot?: boolean
  styles?: string
}

export function defineComponent(name: string, options: Options, factory: Function): void
export function defineComponent<Props>(name: string, options: Options, propDefs: Props, factory: FactoryFunction<Props>): void

export function defineComponent<Props>(
  name: string,
  { shadowRoot, styles }: Options,
  propDefs: Props | Function,
  factory?: FactoryFunction<Props>,
): void {
  if (typeof propDefs === 'function') {
    factory = propDefs as FactoryFunction<Props>
    propDefs = {} as any
  }

  customElements.define(
    name,
    class extends HTMLElement implements VuelitComponent {
      // That's how we tell the browser which props should trigger attributeChangedCallback
      static get observedAttributes() {
        return Object.keys(propDefs as object)
      }

      // Storage for custom props that will be reactive
      #props: Record<string, any> = shallowReactive({})

      // Storage for lifecycle callbacks
      #callbacks = {
        onBeforeMount: [] as LifecycleCallback[],
        onBeforeUpdate: [] as LifecycleCallback[],
        onUpdated: [] as LifecycleCallback[],
        onMounted: [] as LifecycleCallback[],
        onUnmounted: [] as LifecycleCallback[],
      }

      constructor() {
        super()

        this.#createProps()
        const template = this.#initTemplate()

        this.#callbacks.onBeforeMount.forEach(cb => cb.call(this, { component: this }))

        // Web components can but don't have to have slots
        const root = shadowRoot ? this.attachShadow({ mode: 'closed' }) : this
        if (styles) this.#initStyles(styles, root)

        let isMounted = false
        effect(() => {
          if (isMounted) {
            this.#callbacks.onBeforeUpdate.forEach(cb => cb.call(this, { component: this }))
          }
          render(this.#resolveRefs(template()), root)
          if (isMounted) {
            this.#callbacks.onUpdated.forEach(cb => cb.call(this, { component: this }))
          } else {
            isMounted = true
          }
        })
      }

      #createProps() {
        Object.keys(propDefs as object).forEach(prop => {
          Object.defineProperty(this, prop, {
            get() {
              return this.#props[prop]
            },
            set(value: any) {
              this.#props[prop] = value
            },
          })

          // @ts-ignore because we're indexing dynamically generated props here
          this[prop] = (propDefs as Record<string, any>)[prop]
        })
      }

      #initStyles(style: string, root: Node) {
        const container = document.createElement('style')
        container.innerHTML = style
        root.appendChild(container)
      }

      #initTemplate() {
        currentInstance = this
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const template = factory!.call(this, { component: this, props: this.#props as Props })
        currentInstance = null

        return template
      }

      // Teach Lit how to dereference Vue's refs so in the template
      // we don't have to write something.value every single time
      #resolveRefs(renderResult: { values: any[] }) {
        return {
          ...renderResult,
          values: renderResult.values.map(value => isRef(value) ? value.value : value),
        }
      }

      connectedCallback() {
        this.#callbacks.onMounted.forEach(cb => cb.call(this, { component: this }))
      }

      disconnectedCallback() {
        this.#callbacks.onUnmounted.forEach(cb => cb.call(this, { component: this }))
      }

      attributeChangedCallback(attrName: string, oldValue: any, newValue: any) {
        this.#props[attrName] = newValue
      }

      registerLifecycleCallback(method: LifecycleMethod, callback: LifecycleCallback) {
        this.#callbacks[method].push(callback)
      }
    },
  )
}

function createLifecycleMethod(name: LifecycleMethod) {
  return (callback: LifecycleCallback) => {
    currentInstance?.registerLifecycleCallback(name, callback)
  }
}

/**
 * This function understands that the given reference could be reactive
 * and if that is the case it will assign it's `value` to the event
 * target's value (much like Vue's v-model does)
 */
export function update(reference: MaybeRef) {
  return (e: InputEvent) => {
    if (isRef(reference)) {
      reference.value = (e.target as HTMLInputElement).value
    } else {
      console.warn('A non-reactive reference was passed - not updating')
    }
  }
}

/**
 * Register a callback that is executed before the component is mounted in the DOM
 */
export const onBeforeMount = createLifecycleMethod('onBeforeMount')

/**
 * Register a callback that is executed right after the component is mounted in the DOM
 */
export const onMounted = createLifecycleMethod('onMounted')

/**
 * Register a callback that is executed before the component's property is updated
 */
export const onBeforeUpdate = createLifecycleMethod('onBeforeUpdate')

/**
 * Register a callback that is executed right after the component is mounted
 */
export const onUpdated = createLifecycleMethod('onUpdated')

/**
 * Register a callback that is executed after the component has been unmounted from the DOM
 */
export const onUnmounted = createLifecycleMethod('onUnmounted')

export * from 'lit-html'
export * from '@vue/reactivity'
