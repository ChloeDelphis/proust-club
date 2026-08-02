package com.proustclub.search;

import com.proustclub.search.dto.SearchHit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchServiceTest {

    @Mock
    SearchRepository repository;

    @InjectMocks
    SearchService service;

    @Test
    void searchAssemblesResponse() {
        var hit = new SearchHit(1, "La madeleine est un symbole.", 3, 12, "Du CÃ´tÃ© de Chez Swann", "Combray", 1);
        when(repository.search("madeleine", 0, 10)).thenReturn(List.of(hit));
        when(repository.count("madeleine")).thenReturn(1L);

        var response = service.search("madeleine", 0, 10);

        assertThat(response.results()).containsExactly(hit);
        assertThat(response.total()).isEqualTo(1L);
        assertThat(response.page()).isEqualTo(0);
        assertThat(response.size()).isEqualTo(10);
    }

    @Test
    void searchReturnsEmptyResponseWhenNoResults() {
        when(repository.search("DostoÃ¯evski", 0, 10)).thenReturn(List.of());
        when(repository.count("DostoÃ¯evski")).thenReturn(0L);

        var response = service.search("DostoÃ¯evski", 0, 10);

        assertThat(response.results()).isEmpty();
        assertThat(response.total()).isEqualTo(0L);
    }
}
