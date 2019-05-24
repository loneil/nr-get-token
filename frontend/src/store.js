import Vue from 'vue';
import Vuex from 'vuex';
import { ApiService } from '@/common/apiService';
import { AuthRoutes } from '@/utils/constants';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    configSubmissionSuccess: '',
    configSubmissionError: '',
    userAppCfg: {
      applicationAcronym: '',
      applicationName: '',
      applicationDescription: '',
      commonServices: [],
      deploymentMethod: ''
    },
    generatedPassword: '',
    healthCheck: null,
    apiCheckResponse: '',
    ephemeralPasswordRSAKey: null,
    token: localStorage.getItem('jwt') || ''
  },
  getters: {
    isAuthenticated: state => !!state.token,
    configSubmissionSuccess: state => state.configSubmissionSuccess,
    configSubmissionError: state => state.configSubmissionError,
    generatedPassword: state => state.generatedPassword,
    ephemeralPasswordRSAKey: state => state.ephemeralPasswordRSAKey,
    appConfigAsString: state => {
      // these are the hardcoded WebADE cfg values users do not enter
      const defaultAppCfg = {
        '@type': 'http://webade.gov.bc.ca/applicationConfiguration',
        applicationAcronym: '',
        custodianNumber: 0,
        applicationName: '',
        applicationDescription: '',
        applicationObjectPrefix: null,
        enabledInd: true,
        distributeTypeCd: null,
        managementEnabledInd: false,
        applicationVersion: null,
        reportedWebadeVersion: null,
        actions: [],
        roles: [],
        wdePreferences: [],
        applicationPreferences: [],
        globalPreferences: [],
        defaultUserPreferences: [],
        profiles: [],
        serviceClients: [],
        groupAuthorizations: []
      };

      // Set up the conditional JSON structure based on user entry
      const newAppCfg = {
        applicationAcronym: state.userAppCfg.applicationAcronym,
        applicationName: state.userAppCfg.applicationName,
        applicationDescription: state.userAppCfg.applicationDescription
      };

      if (!state.userAppCfg.applicationAcronym) {
        newAppCfg.serviceClients = [];
      } else {
        newAppCfg.serviceClients = [{
          accountName: `${newAppCfg.applicationAcronym}_SERVICE_CLIENT`,
          secret: '',
          oauthScopes: [],
          oauthGrantTypes: [],
          oauthRedirectUrls: [],
          oauthAccessTokenValidity: null,
          oauthRefreshTokenValidity: null,
          oauthAdditionalInformation: '{"autoapprove":"true"}',
          authorizations: []
        }];

        if (state.userAppCfg.deploymentMethod === 'deploymentManual') {
          newAppCfg.serviceClients[0].secret = `$\{${newAppCfg.serviceClients[0].accountName}.password}`;
        } else {
          newAppCfg.serviceClients[0].secret = '••••••••';
        }

        if (!state.userAppCfg.commonServices || !state.userAppCfg.commonServices.length) {
          newAppCfg.serviceClients[0].authorizations = [];
        } else {
          newAppCfg.actions = [{
            name: `${newAppCfg.applicationAcronym}_ACTION`,
            description: `${newAppCfg.applicationAcronym} action`,
            privilegedInd: false
          }];
          newAppCfg.roles = [{
            name: `${newAppCfg.applicationAcronym}_ROLE`,
            description: `${newAppCfg.applicationAcronym} Role`,
            actionNames: [
              `${newAppCfg.applicationAcronym}_ACTION`
            ]
          }];

          newAppCfg.profiles = [{
            name: `${newAppCfg.applicationAcronym}_PROFILE`,
            description: `Can send an email with the ${newAppCfg.applicationAcronym} app`,
            secureByOrganization: false,
            availibleTo: [
              'SCL'
            ],
            effectiveDate: 1506582000000,
            expiryDate: 253402243200000,
            profileRoles: [{
              applicationCode: newAppCfg.applicationAcronym,
              name: `${newAppCfg.applicationAcronym}_ROLE`
            },
            {
              applicationCode: 'CMSG',
              name: 'SENDER'
            }]
          }];

          newAppCfg.serviceClients[0].authorizations = [{
            profileName: `${newAppCfg.applicationAcronym}_PROFILE`,
            profileDescription: 'Test profile description',
            effectiveDate: 1506629523000,
            expiryDate: 253402243200000,
            enabled: true
          }];
        }
      }

      const appCfgVals = {
        ...defaultAppCfg,
        ...newAppCfg,
      };

      return JSON.stringify(appCfgVals, null, 2);
    }
  },
  mutations: {
    updateUserAppCfg: (state, userAppCfg) => {
      Object.assign(state.userAppCfg, userAppCfg);
    },
    setConfigSubmissionSuccess: (state, msg) => {
      state.configSubmissionSuccess = msg;
      state.configSubmissionError = '';
    },
    setConfigSubmissionError: (state, msg) => {
      state.configSubmissionSuccess = '';
      state.configSubmissionError = msg;
    },
    clearConfigSubmissionMsgs: (state) => {
      state.configSubmissionSuccess = '';
      state.configSubmissionError = '';
    },
    setHealthCheck: (state, health) => {
      state.healthCheck = health;
    },
    setApiCheckResponse: (state, val) => {
      state.apiCheckResponse = val;
    },
    setGeneratedPassword: function (state, val) {
      state.generatedPassword = val;
    },
    setEphemeralPasswordRSAKey: function (state, ephemeralPasswordRSAKey) {
      state.ephemeralPasswordRSAKey = ephemeralPasswordRSAKey;
    },
    setJwtToken: (state, jwt) => {
      state.token = jwt;
    }
  },
  actions: {
    async getHealthCheckStatus(context) {
      context.commit('setHealthCheck', null);
      try {
        const response = await ApiService.getHealthCheck();
        context.commit('setHealthCheck', response);
      } catch (e) {
        context.commit('setHealthCheck', 'error');
      }
    },
    async getApiCheck(context, route) {
      context.commit('setApiCheckResponse', '');
      try {
        const response = await ApiService.getApiCheck(route);
        context.commit('setApiCheckResponse', response);
      } catch (e) {
        context.commit('setApiCheckResponse', e);
      }
    },
    async getJwtToken(context) {
      try {
        const response = await fetch(AuthRoutes.TOKEN, {
          method: 'GET'
        });
        const body = await response.json();

        if (body.jwt) {
          localStorage.setItem('jwt', body.jwt);
          context.commit('setJwtToken', body.jwt);
        }

        // TODO: Figure out refresh token process
      } catch (e) {
        localStorage.removeItem('jwt');
        context.commit('setJwtToken', '');
        throw e;
      }
    },
  }
});
