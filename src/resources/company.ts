import { HttpClient } from '../http/client.js';
import {
  CompanyAttendanceItem,
  CompanyEmployeeItem,
  CreateEmployeeParams,
  ListEmployeesQuery,
  PaginatedResult,
  PayrollRunItem,
  RecordCompanyAttendanceParams,
  RequestOptions,
} from '../types';

export class CompanyResource {
  public readonly employees: {
    list: (query?: ListEmployeesQuery, options?: RequestOptions) => Promise<PaginatedResult<CompanyEmployeeItem>>;
    create: (params: CreateEmployeeParams, options?: RequestOptions) => Promise<CompanyEmployeeItem>;
  };

  public readonly attendance: {
    list: (query?: { page?: number; limit?: number; employeeId?: string }, options?: RequestOptions) => Promise<PaginatedResult<CompanyAttendanceItem>>;
    record: (params: RecordCompanyAttendanceParams, options?: RequestOptions) => Promise<CompanyAttendanceItem>;
  };

  public readonly payroll: {
    list: (options?: RequestOptions) => Promise<PaginatedResult<PayrollRunItem>>;
  };

  constructor(private readonly http: HttpClient) {
    this.employees = {
      list: (query?: ListEmployeesQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<CompanyEmployeeItem>>('/company/employees', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            search: query?.search,
            status: query?.status,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateEmployeeParams, options?: RequestOptions) =>
        this.http.post<CompanyEmployeeItem>('/company/employees', params, options),
    };

    this.attendance = {
      list: (query?: { page?: number; limit?: number; employeeId?: string }, options?: RequestOptions) =>
        this.http.get<PaginatedResult<CompanyAttendanceItem>>('/company/attendance', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            employeeId: query?.employeeId,
            ...(options?.query || {}),
          },
        }),
      record: (params: RecordCompanyAttendanceParams, options?: RequestOptions) =>
        this.http.post<CompanyAttendanceItem>('/company/attendance', params, options),
    };

    this.payroll = {
      list: (options?: RequestOptions) =>
        this.http.get<PaginatedResult<PayrollRunItem>>('/company/payroll', options),
    };
  }
}
