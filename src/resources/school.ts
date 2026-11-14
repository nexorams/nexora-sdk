import { HttpClient } from '../http/client.js';
import {
  AttendanceRecordItem,
  CreateParentParams,
  CreateParentResult,
  LinkParentStudentParams,
  ListParentLinksQuery,
  ListParentsQuery,
  ParentItem,
  ParentLinkItem,
  RevokeParentLinkParams,
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

  /**
   * Parent Portal: parent/guardian accounts and their links to students. Requires `parents:read` / `parents:write`.
   * Creating a parent never returns a password — Nexora e-mails the activation link.
   */
  public readonly parents: {
    list: (query?: ListParentsQuery, options?: RequestOptions) => Promise<PaginatedResult<ParentItem>>;
    create: (params: CreateParentParams, options?: RequestOptions) => Promise<CreateParentResult>;
    links: {
      list: (query?: ListParentLinksQuery, options?: RequestOptions) => Promise<PaginatedResult<ParentLinkItem>>;
      create: (params: LinkParentStudentParams, options?: RequestOptions) => Promise<ParentLinkItem>;
      revoke: (params: RevokeParentLinkParams, options?: RequestOptions) => Promise<{ id: string; status: 'REVOKED'; revokedAt: string }>;
    };
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

    this.parents = {
      list: (query?: ListParentsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<ParentItem>>('/school/parents', {
          ...options,
          query: { page: query?.page, limit: query?.limit, search: query?.search, status: query?.status, activation: query?.activation, sort: query?.sort, ...(options?.query || {}) },
        }),
      create: (params: CreateParentParams, options?: RequestOptions) =>
        this.http.post<CreateParentResult>('/school/parents', params, options),
      links: {
        list: (query?: ListParentLinksQuery, options?: RequestOptions) =>
          this.http.get<PaginatedResult<ParentLinkItem>>('/school/parents/links', {
            ...options,
            query: { page: query?.page, limit: query?.limit, parentId: query?.parentId, studentId: query?.studentId, status: query?.status, ...(options?.query || {}) },
          }),
        create: (params: LinkParentStudentParams, options?: RequestOptions) =>
          this.http.post<ParentLinkItem>('/school/parents/links', params, options),
        revoke: (params: RevokeParentLinkParams, options?: RequestOptions) =>
          this.http.post<{ id: string; status: 'REVOKED'; revokedAt: string }>('/school/parents/links/revoke', params, options),
      },
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
