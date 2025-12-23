import { TestBed } from '@angular/core/testing';

import { DependencyResolverService } from './dependency-resolver.service';

describe('DependencyResolverService', () => {
  let service: DependencyResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DependencyResolverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
