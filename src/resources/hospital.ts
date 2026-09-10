import { HttpClient } from '../http/client.js';
import {
  AppointmentItem,
  CreateAppointmentParams,
  CreatePatientParams,
  ListAppointmentsQuery,
  ListPatientsQuery,
  ListVitalsQuery,
  PaginatedResult,
  PatientItem,
  RecordVitalsParams,
  RequestOptions,
  VitalSignItem,
} from '../types';

export class HospitalResource {
  public readonly patients: {
    list: (query?: ListPatientsQuery, options?: RequestOptions) => Promise<PaginatedResult<PatientItem>>;
    create: (params: CreatePatientParams, options?: RequestOptions) => Promise<PatientItem>;
  };

  public readonly appointments: {
    list: (query?: ListAppointmentsQuery, options?: RequestOptions) => Promise<PaginatedResult<AppointmentItem>>;
    create: (params: CreateAppointmentParams, options?: RequestOptions) => Promise<AppointmentItem>;
  };

  public readonly vitals: {
    list: (query?: ListVitalsQuery, options?: RequestOptions) => Promise<PaginatedResult<VitalSignItem>>;
    record: (params: RecordVitalsParams, options?: RequestOptions) => Promise<VitalSignItem>;
  };

  constructor(private readonly http: HttpClient) {
    this.patients = {
      list: (query?: ListPatientsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<PatientItem>>('/hospital/patients', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            search: query?.search,
            gender: query?.gender,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreatePatientParams, options?: RequestOptions) =>
        this.http.post<PatientItem>('/hospital/patients', params, options),
    };

    this.appointments = {
      list: (query?: ListAppointmentsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<AppointmentItem>>('/hospital/appointments', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            status: query?.status,
            patientId: query?.patientId,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateAppointmentParams, options?: RequestOptions) =>
        this.http.post<AppointmentItem>('/hospital/appointments', params, options),
    };

    this.vitals = {
      list: (query?: ListVitalsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<VitalSignItem>>('/hospital/vitals', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            patientId: query?.patientId,
            ...(options?.query || {}),
          },
        }),
      record: (params: RecordVitalsParams, options?: RequestOptions) =>
        this.http.post<VitalSignItem>('/hospital/vitals', params, options),
    };
  }
}
