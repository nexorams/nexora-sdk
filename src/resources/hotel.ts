import { HttpClient } from '../http/client.js';
import {
  CreateReservationParams,
  HotelGuestItem,
  HotelRoomItem,
  ListHotelRoomsQuery,
  ListReservationsQuery,
  PaginatedResult,
  RequestOptions,
  ReservationItem,
} from '../types';

export class HotelResource {
  public readonly rooms: {
    list: (query?: ListHotelRoomsQuery, options?: RequestOptions) => Promise<PaginatedResult<HotelRoomItem>>;
  };

  public readonly reservations: {
    list: (query?: ListReservationsQuery, options?: RequestOptions) => Promise<PaginatedResult<ReservationItem>>;
    create: (params: CreateReservationParams, options?: RequestOptions) => Promise<ReservationItem>;
  };

  public readonly guests: {
    list: (options?: RequestOptions) => Promise<PaginatedResult<HotelGuestItem>>;
  };

  constructor(private readonly http: HttpClient) {
    this.rooms = {
      list: (query?: ListHotelRoomsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<HotelRoomItem>>('/hotel/rooms', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            status: query?.status,
            ...(options?.query || {}),
          },
        }),
    };

    this.reservations = {
      list: (query?: ListReservationsQuery, options?: RequestOptions) =>
        this.http.get<PaginatedResult<ReservationItem>>('/hotel/reservations', {
          ...options,
          query: {
            page: query?.page,
            limit: query?.limit,
            status: query?.status,
            ...(options?.query || {}),
          },
        }),
      create: (params: CreateReservationParams, options?: RequestOptions) =>
        this.http.post<ReservationItem>('/hotel/reservations', params, options),
    };

    this.guests = {
      list: (options?: RequestOptions) =>
        this.http.get<PaginatedResult<HotelGuestItem>>('/hotel/guests', options),
    };
  }
}
