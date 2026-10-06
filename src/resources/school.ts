import { HttpClient } from '../http/client.js';
import {
  AttendanceRecordItem,
  CreateSchoolClassParams,
  CreateStudentParams,
  ListAttendanceQuery,
  ListResultsQuery,
  ListSchoolClassesQuery,
  ListSchoolPaymentsQuery,
  ListTeachersQuery,
  ResultItem,
  SchoolPaymentItem,
  TeacherItem,
  ListStudentsQuery,
  PaginatedResult,
  RecordAttendanceParams,
  RequestOptions,
  SchoolClassItem,
  StudentItem,
} from '../types';

export class SchoolResource {
  public readonly students: {
    list: (query?: ListStudentsQuery, options?: RequestOptions) => Promise<PaginatedResult<StudentItem>>;
    create: (params: CreateStudentParams, options?: RequestOptions) => Promise<StudentItem>;
  };

  public readonly attendance: {
    list: (query?: ListAttendanceQuery, options?: RequestOptions) => Promise<PaginatedResult<AttendanceRecordItem>>;
    record: (params: RecordAttendanceParams, options?: RequestOptions) => Promise<any>;
  };

  public readonly classes: {
    list: (query?: ListSchoolClassesQuery, options?: RequestOptions) => Promise<PaginatedResult<SchoolClassItem>>;
    create: (params: CreateSchoolClassParams, options?: RequestOptions) => Promise<SchoolClassItem>;
  };

  public readonly teachers: {
    list: (query?: ListTeachersQuery, options?: RequestOptions) => Promise<PaginatedResult<TeacherItem>>;
  };

  /** Published results only. Requires the `results:read` scope. */
  public readonly results: {
    list: (query?: ListResultsQuery, options?: RequestOptions) => Promise<PaginatedResult<ResultItem>>;
  };

  /** Requires the `payments:read` scope. */
  public readonly payments: {
    list: (query?: ListSchoolPaymentsQuery, options?: RequestOptions) => Promise<PaginatedResult<SchoolPaymentItem>>;
  };

  constructor(private readonly http: HttpClient) {
    this.teachers = {
      list: (query?: ListTeachersQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<TeacherItem>>('/school/teachers', {
          ...options,
          query: { page: query?.page, limit: query?.limit, ...(options?.query || {}) },
        }),
    };

    this.results = {
      list: (query?: ListResultsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<ResultItem>>('/school/results', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            academicSession: query?.academicSession,
            term: query?.term,
            studentId: query?.studentId,
            ...(options?.query || {}),
          },
        }),
    };

    this.payments = {
      list: (query?: ListSchoolPaymentsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<SchoolPaymentItem>>('/school/payments', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            status: query?.status,
            academicSession: query?.academicSession,
            term: query?.term,
            ...(options?.query || {}),
          },
        }),
    };

    this.students = {
      list: (query?: ListStudentsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<StudentItem>>('/school/students', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            search: query?.search,
            status: query?.status,
            classId: query?.classId,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateStudentParams, options?: RequestOptions) =>
        this.http.post<StudentItem>('/school/students', params, options),
    };

    this.attendance = {
      list: (query?: ListAttendanceQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<AttendanceRecordItem>>('/school/attendance', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            classId: query?.classId,
            date: query?.date,
            ...(options?.query || {}),
          },
        }),
      record: (params: RecordAttendanceParams, options?: RequestOptions) =>
        this.http.post<any>('/school/attendance', params, options),
    };

    this.classes = {
      list: (query?: ListSchoolClassesQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<SchoolClassItem>>('/school/classes', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateSchoolClassParams, options?: RequestOptions) =>
        this.http.post<SchoolClassItem>('/school/classes', params, options),
    };
  }
}
