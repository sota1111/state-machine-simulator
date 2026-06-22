import axios from 'axios'
import type { StateMachine, StateMachineInput, SimulateRequest, SimulateResponse, SimulationHistory, AnalysisResult, ParseResponse, RefineRequest } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const getModels = (isSample?: boolean): Promise<StateMachine[]> =>
  api.get('/models/', isSample === undefined ? undefined : { params: { is_sample: isSample } }).then(r => r.data)

export const getModel = (id: string): Promise<StateMachine> =>
  api.get(`/models/${id}`).then(r => r.data)

export const createModel = (data: StateMachineInput): Promise<StateMachine> =>
  api.post('/models/', data).then(r => r.data)

export const updateModel = (id: string, data: StateMachineInput): Promise<StateMachine> =>
  api.put(`/models/${id}`, data).then(r => r.data)

export const deleteModel = (id: string): Promise<void> =>
  api.delete(`/models/${id}`).then(r => r.data)

export const getAnalysis = (id: string): Promise<AnalysisResult> =>
  api.get(`/models/${id}/analysis`).then(r => r.data)

export const simulateStep = (id: string, data: SimulateRequest): Promise<SimulateResponse> =>
  api.post(`/models/${id}/simulate`, data).then(r => r.data)

export const getHistory = (id: string): Promise<SimulationHistory[]> =>
  api.get(`/models/${id}/history`).then(r => r.data)

export const parseText = (text: string): Promise<ParseResponse> =>
  api.post('/parse/', { text }).then(r => r.data)

export const refineWorkflow = (data: RefineRequest): Promise<ParseResponse> =>
  api.post('/parse/refine', data).then(r => r.data)
