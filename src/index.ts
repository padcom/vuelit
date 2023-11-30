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
  /**
   * Provide a value to children
   *
   * @param key key to reference the value in `inject()`
   * @param value the provided value
   */
  provide(key: Symbol, value: any): void
  /**
   * Inject a value provided by `provide()`
   *
   * @param key key to reference the value provided by `provide()`
   * @param defaultValue optional default value if the value has not been provided
   * @returns value if it has been provided, `defaultValue` if provided or `null`
   */
  inject<T>(key: Symbol, defaultValue?: T): T | null
}

type RenderFunction = () => TemplateResult

interface FactoryFunctionParams<Props> {
  component: VuelitComponent
  props: Props
}

type FactoryFunction<Props> = (this: VuelitComponent, context: FactoryFunctionParams<Props>) => RenderFunction

interface Options {
  shadowRoot?: boolean
  styles?: string
}

let currentInstance: VuelitComponent | null

/**
 * Returns the current component instance so that you can use it in composables
 *
 * @returns {VuelitComponent} component instance
 */
export function getCurrentInstance() {
  if (!currentInstance) {
    console.error('the getCurrentInstance() function can only be used inside of component setup')
  }

  return currentInstance
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

      #context = new WeakMap<Symbol, any>()

      constructor() {
        super()

        this.#initProps()
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

      #initProps() {
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

      provide(key: Symbol, value: any) {
        this.#context.set(key, value)
      }

      inject<T>(key: Symbol, defaultValue?: T): T | null {
        if (this.#context.has(key)) {
          return this.#context.get(key)
        }

        function get(element: Node | null): T | null {
          if (!element) {
            return defaultValue || null
          }

          const injector = element as any
          if (injector.inject) {
            return injector.inject(key)
          } else {
            return get(element.parentNode)
          }
        }

        const result = get(this.parentNode)
        if (!result) {
          if (defaultValue === undefined) {
            console.warn('Injection key', key, 'not found!')
            return null
          } else {
            return defaultValue || null
          }
        } else {
          return result
        }
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
 * Provide a value to children
 *
 * @param key key to reference the value in `inject()`
 * @param value the provided value
 */
export function provide(key: Symbol, value: any) {
  const instance = getCurrentInstance()
  if (instance) {
    currentInstance?.provide(key, value)
  }
}

/**
 * Inject a value provided by `provide()`
 *
 * @param key key to reference the value provided by `provide()`
 * @returns value if it has been provided or null
 */
export function inject<T>(key: Symbol, defaultValue?: T) {
  const instance = getCurrentInstance()
  if (instance) {
    return instance.inject<T>(key)
  } else {
    return defaultValue
  }
}

/**
 * Define a _thing_ to be exposed from the current component.
 * It's very useful to add methods to your components. This allows to create APIs that are
 * similar to the  `dialog.open()` or `form.submit()`
 *
 * You can accomplish a similar thing by just assigning a field to your `component` like this:
 *
 * ```
 * defineComponent('example-component', {}, {}, ({ component }) => {
 *   component.something = 'here'
 * })
 * ```
 *
 * However this function works with `Object.defineProperty()` which allows for creation of
 * readonly properties. That's very useful when adding methods. Plus the API is just nicer.
 *
 * @param things things to export
 * @param options options when defining the thing
 */
export function expose(things: Record<string, any>, options: Omit<PropertyDescriptor, 'value' | 'get' | 'set'> = {}) {
  const instance = getCurrentInstance()
  if (instance) {
    Object.entries(things).forEach(([name, value]) => {
      Object.defineProperty(instance, name, { ...options, value })
    })
  }
}

export * from 'lit-html'
export * from '@vue/reactivity'
