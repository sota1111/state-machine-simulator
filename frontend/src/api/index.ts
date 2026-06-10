import axios from 'axios'
import type { StateMachine, SimulateRequest, SimulateResponse, SimulationHistory, AnalysisResult, ParseResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

export const getModels = (): Promise<StateMachine[]> =>
  api.get('/models/').then(r => r.data)

export const getModel = (id: string): Promise<StateMachine> =>
  api.get(`/models/${id}`).then(r => r.data)

export const createModel = (data: Omit<StateMachine, 'id' | 'created_at' | 'updated_at'>): Promise<StateMachine> =>
  api.post('/models/', data).then(r => r.data)

export const updateModel = (id: string, data: Omit<StateMachine, 'id' | 'created_at' | 'updated_at'>): Promise<StateMachine> =>
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
