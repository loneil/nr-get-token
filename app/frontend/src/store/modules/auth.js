import Vue from 'vue';

export default {
  namespaced: true,
  state: {},
  getters: {
    authenticated: () => Vue.prototype.$keycloak.authenticated,
    createLoginUrl: () => options => Vue.prototype.$keycloak.createLoginUrl(options),
    createLogoutUrl: () => options => Vue.prototype.$keycloak.createLogoutUrl(options),
    ready: () => Vue.prototype.$keycloak.ready,
    realmAccess: () => Vue.prototype.$keycloak.tokenParsed.realm_access,
    resourceAccess: () => Vue.prototype.$keycloak.tokenParsed.resource_access,
    subject: () => Vue.prototype.$keycloak.subject,
    tokenParsed: () => Vue.prototype.$keycloak.tokenParsed
  },
  mutations: {},
  actions: {}
};
