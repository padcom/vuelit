# Vuelit - Lit with Vue's reactivity system

This project is a spin-off off a project initially created as a PoC by Evan You in 2020.

You can check the original project [here](https://www.npmjs.com/package/@vue/lit)

The point of this library is to be able to create Lit components using the reactivity system of Vue.js. Currently the industry trend is to add signals to every framework out there. Luckily, Vue.js has added it already years ago. What's even nicer is that the implementation is extracted to a separate package which makes it much easier to integrate in other tools.

## Differences from the original project

The main differences in this implementation are:

- full TypeScript support
- hidden state / clean(er) API
- automatic dereferencing of Vue.js' `ref`
- 2-way binding
- `provide`/`inject`

## Getting started

Vuelit uses the [from-github](https://npmjs.org/package/create-from-github) generator which just clones the given repository and clears it out to a point where it is usable as a new project:

```
npm create from-github padcom/vuelit-template hello-world
```

The project is very simple but has everything that is needed to get you started.

## Example component

Since the framework is designed to create [webcomponents](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) there is no application framework that you need to instantiate. All you need is your component and an `index.html` to put the tag in.

Here's how you define a component:

```typescript
import { defineComponent, html } from 'vuelit'

const styles = `
  :host {
    font-family: monospace
  }
`

defineComponent(
  // name of the tag that you will later on use in HTML
  'hello-world',
  {
    // Styles are passed as plain text. You can get them from an external file
    // or specify them in-line. Your choice
    styles,
    // Should the component have a `shadowRoot`? (default: false)
    shadowRoot: true
  },
  // A list of reactive properties that will be added to the instance
  {
    counter: 0
  },
  // The `props` are the same as defined above
  ({ props }) => {
    function increment() {
      props.counter++
    }

    // From here on it's all Lit
    return () => html`
      <h2>Number of clicks: ${props.counter}</h2>
      <button @click="${increment}">Increment</button>
      <p>Now delete me and get to work!</p>
    `
  }
)
```

## Using reactive `ref` and 2-way data binding

Vuelit understands that Vue's [`ref`](https://vuejs.org/api/reactivity-core.html#ref) has a `.value` field. You don't need to dereference it manually.

If you want to react to the `@input` event to implement 2-way binding there's a special `update()` function that you'd use as follows:

```typescript
import { defineComponent, html, ref, update } from 'vuelit'

defineComponent('hello-world', {}, {}, () => {
  const message = ref('Hello, world!')

  return () => html`
    <input .value="${message}" @input="${update(message)}">
    ${message}
  `
})
```

## Lifecycle hooks

Just like Vue.js, Vuelit exposes a number of lifecycle hooks:

### `onBeforeMount(({ component }) => void)`

This lifecycle hook is called after the setup function has completed but before the component is mounted to the DOM

### `onMounted(({ component }) => void)`

This lifecycle hook is called right after the component is mounted in the DOM

### `onBeforeUpdate(({ component }) => void)`

This lifecycle hook is called once a change in props is detected but before the internal state is updated

### `onUpdated(({ component }) => void)`

This lifecycle hook is called once a change in props is detected and after the internal state is updated

### `onUnmounted(({ component }) => void)`

This lifecycle hook is called after the component has been unmounted from the DOM

## `getComponentInstance(): VuelitComponent` - getting component instance

First things first: each Vuelit component is actually a valid DOM element. So if you will `console.log` it, it will be a DOM element.

In many different places getting access to that instance might be very useful, for example to examine some props and/or attributes or to call a method on that given object.

All lifecycle hooks are provided the `component` instance so you don't have to get it yourself. However, in composables that don't use the lifecycle hooks you still might want to access the `component` instance. For those rare cases there's the `getComponentInstance()` function exposed from Vuelit.

## Dependency injection

Vue.js provides a dependency injection mechanism that's really useful for mitigating prop drilling. [Vue.js](https://vuejs.org/guide/components/provide-inject.html) does it using [provide](https://vuejs.org/api/options-composition.html#provide)/[inject](https://vuejs.org/api/options-composition.html#inject) composition functions.

Vuelit is no different. It provides the same functionality using `provide()` and `inject()` composition functions:

### `[component.]provide(key: Symbol, value: any)`

Provides a value for injection using `inject()`. Please note `key` needs to be a `Symbol` because the underlying mechanism storing the provided values is a `WeakMap`.

Please note that both the component instance, that you can access by destructuring it from the first parameter of your composition function as well as a standalone function exported from the library expose this function. This means that in runtime, if you're using Vuelit, you can also dynamically provide values for later injections.

### `[component.]inject<T>(key: Symbol, defaultValue: T): T | null`

Injects a value provided using `inject()`. Please note `key` needs to be a `Symbol` because the underlying mechanism storing the provided values is a `WeakMap`.

Please note that both the component instance, that you can access by destructuring it from the first parameter of your composition function as well as a standalone function exported from the library expose this function. This means that in runtime, if you're using Vuelit, you can also dynamically retrieve values from providers.

### Example

Let's assume we have 2 components:

- `<counter-provider>` that will provide a reactive counter
- `<counter-display>` that will display and allow for manipulation of the counter

This is how you would implement this:

```typescript
const counterSymbol = Symbol('counter')

defineComponent('counter-provider', {}, {}, () => {
  const counter = ref(0)

  provide(counterSymbol, counter)

  return () => html``
})

defineComponent('counter-display', {}, {}, () => {
  const counter = inject<Ref<number>>(counterSymbol)

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
```

As you can see you can literally provide any value, including reactive refs. The `provide`/`inject` pair doesn't care.

Alternatively you can use the component instance instead of the imported methods:

```typescript
defineComponent('counter-provider', {}, {}, ({ component }) => {
  component.provide(counterSymbol, ref(0))
  ...

defineComponent('counter-display', {}, {}, ({ component }) => {
  const counter = component.inject<Ref<number>>(counterSymbol)
```

## Credits

Big thank you to to Evan You and the entire Vue.js team.
