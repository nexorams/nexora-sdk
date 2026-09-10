import { HttpClient } from '../http/client.js';
import {
  CreateProductParams,
  ListProductsQuery,
  PaginatedResult,
  PharmacyProductItem,
  PharmacySaleItem,
  PrescriptionItem,
  RequestOptions,
} from '../types';

export class PharmacyResource {
  public readonly products: {
    list: (query?: ListProductsQuery, options?: RequestOptions) => Promise<PaginatedResult<PharmacyProductItem>>;
    create: (params: CreateProductParams, options?: RequestOptions) => Promise<PharmacyProductItem>;
  };

  public readonly prescriptions: {
    list: (options?: RequestOptions) => Promise<PaginatedResult<PrescriptionItem>>;
  };

  public readonly sales: {
    list: (options?: RequestOptions) => Promise<PaginatedResult<PharmacySaleItem>>;
  };

  constructor(private readonly http: HttpClient) {
    this.products = {
      list: (query?: ListProductsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<PharmacyProductItem>>('/pharmacy/products', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            search: query?.search,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateProductParams, options?: RequestOptions) =>
        this.http.post<PharmacyProductItem>('/pharmacy/products', params, options),
    };

    this.prescriptions = {
      list: (options?: RequestOptions) =>
        this.http.get<PaginatedResult<PrescriptionItem>>('/pharmacy/prescriptions', options),
    };

    this.sales = {
      list: (options?: RequestOptions) =>
        this.http.get<PaginatedResult<PharmacySaleItem>>('/pharmacy/sales', options),
    };
  }
}
